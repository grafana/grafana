# Leak Analysis: AvailableConditionController Queue

## Multiple Entry Points - No Coordination

The same API service can be added to the queue from **6 different sources**:

1. **`addAPIService`** (line 419) - When API service is created
2. **`updateAPIService`** (line 429) - When API service is updated  
3. **`deleteAPIService`** (line 450) - When API service is deleted
4. **`addService`** (line 489) - When related service is created
5. **`updateService`** (line 495) - When related service is updated
6. **`deleteService`** (line 514) - When related service is deleted
7. **Resync every 30s** (line 127) - **Periodic re-add of ALL API services**

Plus:
- **Failed syncs** via `AddRateLimited` (line 408)

## The Leak: Resync Doesn't Respect Queue State

### Problem 1: Resync Adds Items Regardless of Queue State

```go
// Line 121-127: Resync handler
apiServiceHandler, _ := apiServiceInformer.Informer().AddEventHandlerWithResyncPeriod(
    cache.ResourceEventHandlerFuncs{
        AddFunc:    c.addAPIService,    // Adds to queue
        UpdateFunc: c.updateAPIService, // Adds to queue
        DeleteFunc: c.deleteAPIService, // Adds to queue
    },
    30*time.Second)  // Every 30 seconds!
```

**What happens:**
- Every 30 seconds, resync fires for ALL API services
- Calls `addAPIService`/`updateAPIService` for each one
- These call `queue.Add()` **even if the item is:**
  - Already in the queue
  - Currently being processed
  - In the backoff queue waiting for retry

### Problem 2: Resync + Failed Syncs = Double Addition

**Timeline:**
1. T=0s: Resync adds API service → queue
2. T=0.1s: Worker processes, sync fails → `AddRateLimited` (backoff: 5ms)
3. T=0.105s: Backoff expires, worker processes again → sync fails → `AddRateLimited` (backoff: 10ms)
4. T=0.115s: Backoff expires, worker processes again → sync fails → `AddRateLimited` (backoff: 20ms)
5. ...
6. T=30s: **Resync fires again** → adds same API service → queue
7. Now you have: item in backoff queue + item from resync = **duplicate processing**

### Problem 3: Service Events Multiply Entries

When a service changes:
```go
// Line 488-490
func (c *AvailableConditionController) addService(obj interface{}) {
    for _, apiService := range c.getAPIServicesFor(obj.(*v0alpha1.ExternalName)) {
        c.queue.Add(apiService)  // Can add multiple API services
    }
}
```

If one service is used by multiple API services, a single service event can queue multiple API services.

### Problem 4: Workqueue Deduplication May Not Help

`workqueue.Add()` does deduplicate items **that are currently in the queue**, but:
- If item is being processed (`queue.Get()` was called), it's not "in queue" anymore
- Resync can add it again while it's being processed
- When processing finishes and fails, `AddRateLimited` adds it again
- Result: **Multiple entries for the same item**

## Request Volume Amplification

### Without Leak (Theoretical)
- 1 API service failing
- Resync every 30s: 5 requests
- Retries with backoff: ~10-15 requests in 30s
- **Total: ~15-20 requests per 30s = 0.5-0.67 req/s**

### With Leak (Actual)
- 1 API service failing
- Resync adds item every 30s
- Item gets processed, fails, added to backoff
- **Resync adds it again while in backoff** → duplicate
- Both get processed → both fail → both added to backoff
- Next resync adds 2 more → now 4 in queue
- **Exponential growth**: 1 → 2 → 4 → 8 → 16 → ...

**After 2 minutes:**
- Queue has accumulated 8-16 entries for same API service
- Each entry makes 5 concurrent requests when processed
- **8 entries × 5 requests = 40 requests per sync cycle**
- With 5 workers processing: **200+ requests in a few seconds**

### Multiple API Services

If you have 10 API services failing:
- Each leaks independently
- **10 services × 8-16 entries each = 80-160 queue entries**
- **80-160 entries × 5 requests = 400-800 requests per sync cycle**
- With rapid retries: **4,000+ requests/second**

## Root Causes

1. **Resync doesn't check if item is already queued/processing**
   - Every 30s, resync fires for ALL API services
   - Calls `queue.Add()` regardless of queue state
   - Workqueue deduplication only works for items currently in queue, not items in backoff

2. **No coordination between resync and retry mechanisms**
   - Resync adds items every 30s
   - Failed syncs add items with exponential backoff (5ms → 30s)
   - These two mechanisms compete and compound

3. **Multiple event handlers can add same item simultaneously**
   - API service events (add/update/delete)
   - Service events (add/update/delete)  
   - Resync (periodic)
   - Failed syncs (retry)
   - All can add the same item concurrently

4. **Failed items accumulate faster than they're processed**
   - Processing takes time (5 concurrent attempts with staggered delays)
   - Resync keeps adding while processing
   - Backoff queue grows unbounded

## The Critical Leak Pattern

**Timeline for 1 failing API service:**

1. **T=0s**: Resync fires → `addAPIService()` → `queue.Add("provisioning.grafana.app/v0alpha1")`
2. **T=0.1s**: Worker processes → sync() makes 5 requests → all fail (401)
3. **T=0.2s**: `AddRateLimited()` → item in backoff queue (delay: 5ms)
4. **T=0.205s**: Backoff expires → worker processes → sync() makes 5 requests → all fail
5. **T=0.3s**: `AddRateLimited()` → item in backoff queue (delay: 10ms)
6. **T=0.31s**: Backoff expires → worker processes → sync() makes 5 requests → all fail
7. **T=0.4s**: `AddRateLimited()` → item in backoff queue (delay: 20ms)
8. **...**
9. **T=30s**: **RESYNC FIRES AGAIN** → `addAPIService()` → `queue.Add("provisioning.grafana.app/v0alpha1")`
   - Item is already in backoff queue
   - But resync adds it to main queue anyway
   - **Now you have: 1 in backoff + 1 in queue = DUPLICATE**

10. **T=30.1s**: Worker processes queue item → makes 5 requests → fails
11. **T=30.2s**: `AddRateLimited()` → now 2 items in backoff
12. **T=30.3s**: Backoff expires → worker processes first backoff item → makes 5 requests → fails
13. **T=30.4s**: `AddRateLimited()` → now 3 items in backoff
14. **...**
15. **T=60s**: **RESYNC FIRES AGAIN** → adds another → now 4+ items

**Result**: Exponential growth of queue entries for the same API service!

## Why Workqueue Deduplication Doesn't Help

`workqueue.Add()` deduplicates items **currently in the queue**, but:
- Items in **backoff queue** are not "in queue" - they're in a separate delay queue
- Resync can add items even when they're in backoff
- When backoff expires, item moves to main queue
- Resync adds another → now you have duplicates

## Request Volume Calculation (With Leak)

**After 2 minutes with 1 failing API service:**
- Queue entries: 4-8 duplicates
- Each entry: 5 concurrent requests per sync
- Sync frequency: Every few seconds (backoff + resync)
- **4 entries × 5 requests × 2 syncs/second = 40 requests/second**

**With 10 failing API services:**
- **10 services × 40 req/s = 400 requests/second**
- With multiple aggregator instances: **4,000+ requests/second**

## Fixes Needed

### Fix 1: Skip Resync for Items Already in Queue
```go
func (c *AvailableConditionController) addAPIService(obj interface{}) {
    castObj := obj.(*apiregistrationv1.APIService)
    if castObj.Spec.Service != nil {
        c.rebuildAPIServiceCache()
    }
    // Only add if not already in queue
    if c.queue.Len() == 0 || !c.isInQueue(castObj.Name) {
        c.queue.Add(castObj.Name)
    }
}
```

### Fix 2: Increase Resync Period
Change from 30s to 5 minutes to reduce frequency of resync additions.

### Fix 3: Don't Retry Auth Errors
Auth errors (401) won't resolve with retries - use longer delay or skip.

### Fix 4: Add Queue Length Monitoring
Track queue depth to detect leaks early.
