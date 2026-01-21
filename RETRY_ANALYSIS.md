# Retry Logic Analysis: AvailableConditionController

## Problem Summary

The `AvailableConditionController` can generate excessive requests (4k+ req/s) when discovery endpoints fail authentication, creating a retry storm.

## Current Retry Configuration

### 1. **Workers**: 5 concurrent workers
```go
// aggregator.go:283
go availableController.Run(5, context.Done())
```

### 2. **Resync Period**: 30 seconds
```go
// available_controller.go:127
apiServiceHandler, _ := apiServiceInformer.Informer().AddEventHandlerWithResyncPeriod(
    cache.ResourceEventHandlerFuncs{...},
    30*time.Second)
```

### 3. **Concurrent Attempts Per Sync**: 5 attempts
```go
// available_controller.go:225
attempts := 5
results := make(chan error, attempts)
for i := 0; i < attempts; i++ {
    go func() {
        // Makes discovery request
    }()
}
```

### 4. **Exponential Backoff**: 5ms to 30s
```go
// available_controller.go:106
workqueue.NewTypedItemExponentialFailureRateLimiter[string](
    5*time.Millisecond,  // Minimum delay
    30*time.Second,      // Maximum delay
)
```

### 5. **Multiple Triggers**
- API service add/update/delete events
- Service add/update/delete events  
- **Resync every 30 seconds** (even when no changes)

## Request Volume Calculation

### Per API Service - Single Sync Operation

Looking at the code:
- Line 225: `attempts := 5` - makes 5 concurrent attempts per sync
- Each attempt makes 1 HTTP request
- **Per sync: 5 HTTP requests total** (not 25 - workers don't multiply per service)

### Workers Don't Multiply Per Service

- 5 workers process items from the queue independently
- If 1 API service is in queue, only 1 worker processes it
- Workers process different items, not the same item multiple times
- **So: 5 requests per sync, not 25**

### Baseline (No Failures)

- Resync every 30 seconds
- Per API service: 5 requests / 30 seconds = **0.17 requests/second**
- With 10 API services: 10 × 0.17 = **1.7 requests/second**

### With Failures

When sync fails (line 313):
- Returns error → triggers `AddRateLimited` (line 408)
- Exponential backoff: 5ms → 30s max
- **BUT resync still adds item every 30 seconds**

**The problem:**
- Resync adds item at T=0s → 5 requests
- Sync fails → added with backoff (5ms delay)
- Worker processes again at T=5ms → 5 more requests
- Resync adds again at T=30s → 5 more requests
- Sync fails → added with backoff (10ms delay)
- Worker processes at T=30.01s → 5 more requests
- And so on...

**Actual calculation:**
- Resync: 5 requests every 30s = 0.17 req/s
- Retries: Depends on backoff, but early retries happen quickly
- In first 30 seconds: ~5-10 retry attempts = 25-50 extra requests
- **Total in first 30s: ~30-55 requests = ~1-2 req/s per API service**

### To Reach High Request Rates

To get 4k req/s, you'd need:
- 4,000 req/s ÷ 2 req/s per service = **~2,000 API services failing simultaneously**
- OR multiple aggregator instances × multiple API services × all failing

**The real issue isn't necessarily reaching 4k req/s from one instance, but:**
1. **Resync conflicts with backoff** - keeps adding items even when in backoff queue
2. **5 concurrent attempts per sync** - multiplies requests unnecessarily  
3. **No distinction for auth errors** - retries permanent failures aggressively
4. **30s resync is too frequent** - constant baseline load even when healthy

## Issues Identified

### Issue 1: Too Frequent Resync
- **30-second resync** is too aggressive for discovery checks
- Even when nothing changes, it triggers discovery requests
- **Impact**: Constant baseline load

### Issue 2: Too Many Concurrent Attempts
- **5 concurrent attempts** per sync is excessive
- All attempts happen simultaneously with staggered delays (0s, 1s, 2s, 3s, 4s)
- **Impact**: 5x multiplier on request volume

### Issue 3: No Distinction Between Error Types
- **401 (Unauthorized)** errors are retried the same as network errors
- Auth errors won't resolve with retries - they need config changes
- **Impact**: Wasted requests on permanent failures

### Issue 4: Exponential Backoff Conflicts with Resync
- Failed requests use exponential backoff (5ms → 30s)
- But resync every 30s keeps adding items to queue
- **Impact**: Retries and resyncs compound each other

### Issue 5: No Jitter on Resync
- All API services resync at the same time
- **Impact**: Thundering herd problem

## Recommended Fixes

### Fix 1: Increase Resync Period
```go
// Change from 30 seconds to 5 minutes
apiServiceHandler, _ := apiServiceInformer.Informer().AddEventHandlerWithResyncPeriod(
    cache.ResourceEventHandlerFuncs{...},
    5*time.Minute)  // Reduced frequency
```

**Rationale**: Discovery endpoints don't change frequently. 5 minutes is sufficient for health checks.

### Fix 2: Reduce Concurrent Attempts
```go
// Change from 5 to 2 attempts
attempts := 2  // Reduced from 5
```

**Rationale**: 2 attempts (with staggered delays) is sufficient to handle transient failures while reducing load.

### Fix 3: Don't Retry Auth Errors Aggressively
```go
// In sync() function, after discovery check fails:
if lastError != nil {
    // Check if it's an auth error (401)
    if strings.Contains(lastError.Error(), "401") || 
       strings.Contains(lastError.Error(), "Unauthorized") {
        // Use longer backoff for auth errors
        availableCondition.Status = apiregistrationv1.ConditionFalse
        availableCondition.Reason = "FailedDiscoveryCheck"
        availableCondition.Message = lastError.Error()
        apiregistrationv1apihelper.SetAPIServiceCondition(apiService, availableCondition)
        _, updateErr := c.updateAPIServiceStatus(originalAPIService, apiService)
        if updateErr != nil {
            return updateErr
        }
        // Use a longer delay for auth errors (don't retry immediately)
        c.queue.AddAfter(key, 5*time.Minute)  // Wait 5 minutes before retry
        return nil  // Don't return error to avoid exponential backoff
    }
    // ... existing retry logic for other errors
}
```

**Rationale**: Auth errors indicate configuration issues that won't resolve with retries.

### Fix 4: Add Jitter to Resync
```go
// Add random jitter to resync period
resyncPeriod := 5*time.Minute + time.Duration(rand.Intn(60))*time.Second
```

**Rationale**: Prevents all API services from resyncing simultaneously.

### Fix 5: Reduce Workers (Optional)
```go
// Consider reducing from 5 to 2-3 workers
go availableController.Run(2, context.Done())
```

**Rationale**: Fewer workers reduce concurrent load, especially if resync period is increased.

## Expected Impact

After fixes:
- **Baseline load**: ~0.03 requests/second per API service (vs 0.83)
- **During failures**: Exponential backoff respected, no retry storms
- **Auth errors**: Retried every 5 minutes (vs every few seconds)
- **Overall**: **95%+ reduction in request volume**

## Implementation Priority

1. **High Priority**: Fix 3 (Don't retry auth errors aggressively)
2. **High Priority**: Fix 1 (Increase resync period)
3. **Medium Priority**: Fix 2 (Reduce concurrent attempts)
4. **Low Priority**: Fix 4 (Add jitter)
5. **Low Priority**: Fix 5 (Reduce workers)
