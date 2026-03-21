# Repository Controller Watch Deadlock Investigation

## Executive Summary

The Kubernetes client-go reflector warnings (`"event bookmark expired"`) during repository controller rolling deployments are symptoms of a **goroutine deadlock in the unified storage broadcaster**. The broadcaster's main loop blocks when processing new subscriptions during high event rates, preventing it from sending bookmarks or any other events to waiting clients.

---

## Symptoms

### Observed Behavior During Rolling Deployment

1. **Pod 1** (running) → ✅ Works, receiving events normally
2. **Kill signal sent** → Kubernetes starts rolling update
3. **Pod 2** (starting) → ❌ Cannot subscribe to watch, sees bookmark timeout errors
4. **Pod 1** terminated → Pod 2 continues running but still broken
5. **Pod 3** (SRE restarts operator) → ❌ Same bookmark issue persists
6. **Pod 2** terminated → Pod 3 continues with errors
7. **SRE restarts API server** → ✅ Pod 3 can watch successfully (problem cleared)

### Error Messages

```
I0309 09:07:18.817233  1 reflector.go:1159] "Warning: event bookmark expired"
  err="k8s.io/client-go@v0.35.1/tools/cache/reflector.go:289:
  awaiting required bookmark event for initial events stream,
  no events received for 10.025s"

I0309 09:07:28.817125  1 reflector.go:1159] "Warning: event bookmark expired"
  err="... no events received for 20.025s"

I0309 09:07:38.817262  1 reflector.go:1159] "Warning: event bookmark expired"
  err="... no events received for 30.025s"
```

### Key Observations

- ❌ **Multiple operator restarts do NOT fix the issue**
- ✅ **API server restart DOES fix the issue**
- 🔴 **Problem is server-side, not client-side**
- ⚠️ **Triggered during rolling deployments with concurrent watch establishment**

---

## Root Cause: Broadcaster Deadlock

### Architecture Overview

```
Repository Controller (Pod)
        ↓
    Informer/Reflector (client-go)
        ↓
    Watch() Request
        ↓
    Unified Storage API Server
        ↓
    Broadcaster (single instance)
        ↓
    Backend Storage (writes/events)
```

### The Deadlock

**Location:** `pkg/storage/unified/resource/broadcaster.go`

#### Code Flow Analysis

**1. Broadcaster Main Loop** (lines 204-239):

```go
func (b *broadcaster[T]) stream(input <-chan T) {
    for {
        select {
        case sub := <-b.subscribe:  // NEW SUBSCRIBER
            err := b.cache.ReadInto(sub)  // ⚠️ BLOCKING CALL
            if err != nil {
                close(sub)
                continue
            }
            b.subs[sub] = sub

        case item, ok := <-input:  // NEW EVENT
            if !ok {
                return
            }
            b.cache.Add(item)  // ⚠️ BLOCKING CALL
            for _, sub := range b.subs {
                select {
                case sub <- item:
                default:
                    b.unsubscribe <- sub
                }
            }
        }
    }
}
```

**2. Cache Implementation** (lines 285-314):

```go
func (c *localCache[T]) Add(item T) {
    c.add <- item  // ⚠️ Sends to UNBUFFERED channel
}

func (c *localCache[T]) ReadInto(dst chan T) error {
    r := make(chan T, c.size)
    c.read <- r  // ⚠️ Sends to UNBUFFERED channel
    for item := range r {
        select {
        case dst <- item:
        default:
            return fmt.Errorf("slow consumer")
        }
    }
    return nil
}

func (c *localCache[T]) run() {
    for {
        select {
        case <-c.ctx.Done():
            return
        case item := <-c.add:     // ⚠️ Process adds
            // Store in circular buffer
        case r := <-c.read:       // ⚠️ Process reads
            // Send cached items
        }
    }
}
```

**3. Channel Initialization** (lines 273-274):

```go
c.add = make(chan T)           // ⚠️ UNBUFFERED
c.read = make(chan chan T)     // ⚠️ UNBUFFERED
```

### Deadlock Scenario

```
Timeline during rolling deployment with high event rate:

Time 0: Pod 1 running, broadcaster streaming events
      ┌─────────────────────────────────────────┐
      │ Broadcaster.stream() Goroutine          │
      │   case item := <-input:                 │
      │     b.cache.Add(item)                   │
      │       ↓                                  │
      │     c.add <- item  [BLOCKED]            │
      └─────────────────────────────────────────┘
                     ↓ (waiting for cache.run)
      ┌─────────────────────────────────────────┐
      │ Cache.run() Goroutine                   │
      │   select {                              │
      │     case item := <-c.add:  [WAITING]    │
      │   }                                     │
      └─────────────────────────────────────────┘

Time 1: Pod 2 starts, subscribes to watch
      ┌─────────────────────────────────────────┐
      │ Broadcaster.stream() Goroutine          │
      │   case sub := <-b.subscribe:            │
      │     b.cache.ReadInto(sub)               │
      │       ↓                                  │
      │     c.read <- r  [BLOCKED]              │
      └─────────────────────────────────────────┘
                     ↓ (waiting for cache.run)
      ┌─────────────────────────────────────────┐
      │ Cache.run() Goroutine                   │
      │   select {                              │
      │     case r := <-c.read:  [CAN'T REACH]  │
      │       // Still processing previous add  │
      │   }                                     │
      └─────────────────────────────────────────┘

Time 2: DEADLOCK! 💀
      Broadcaster: Blocked in ReadInto(), waiting for cache.run
      Cache.run:   Blocked processing c.add, but broadcaster not listening

      Result: No events sent, no bookmarks sent
              Client-go reflector times out after 30 seconds
```

### Visual Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                  Broadcaster.stream()                         │
│                   Main Goroutine                              │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  for {                                                        │
│    select {                                                   │
│                                                               │
│      case sub := <-b.subscribe:  ← Pod 2 subscribes         │
│        │                                                      │
│        └─→ b.cache.ReadInto(sub) ──┐                        │
│              │                       │                        │
│              └─→ c.read <- r ───────┼──→ [BLOCKS]           │
│                                      │    Waiting for        │
│                                      │    cache.run          │
│      case item := <-input:           │                       │
│        │                              │                       │
│        └─→ b.cache.Add(item) ────────┼──→ [CAN'T REACH]     │
│              │                        │                       │
│              └─→ c.add <- item ──────┘                       │
│    }                                                          │
│  }                                                            │
└──────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────┐
│                      Cache.run()                              │
│                  Helper Goroutine                             │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  for {                                                        │
│    select {                                                   │
│                                                               │
│      case item := <-c.add:       ⚠️ BLOCKED                  │
│        // Store in circular buffer                           │
│        // But broadcaster isn't sending!                     │
│                                                               │
│      case r := <-c.read:         ⚠️ CAN'T REACH              │
│        // Send cached items                                  │
│        // Never processes this branch                        │
│    }                                                          │
│  }                                                            │
└──────────────────────────────────────────────────────────────┘

💀 DEADLOCK: Both goroutines waiting for each other
```

---

## Why This Happens During Rolling Deployments

### Normal Operation (Single Pod)

```
Events arrive → Add to cache (quick) → Broadcast to subscribers
                     ↓
              Cache operations complete in <1ms
                     ↓
              No contention, no blocking
```

### Rolling Deployment (Multi-Pod)

```
Pod 1: High event rate (many writes)
         ↓
Broadcaster processing Add() operations continuously
         ↓
Pod 2: Starts, immediately subscribes
         ↓
Broadcaster receives Subscribe while processing Add()
         ↓
ReadInto() blocks waiting for cache.run
         ↓
cache.run blocked in Add() operation
         ↓
💀 DEADLOCK
```

### Why Multiple Restarts Make It Worse

1. Pod 2 tries to subscribe → deadlock
2. Pod 3 starts (SRE restart) → tries to subscribe to **same stuck broadcaster**
3. Pod 4 starts → same issue
4. **Broadcaster is shared** across all watch requests
5. Once deadlocked, **all new subscriptions fail**

### Why API Server Restart Fixes It

- Kills the stuck broadcaster goroutines
- Recreates broadcaster with fresh state
- Clears all stuck channels
- New watch subscriptions succeed

---

## The Two Issues

### Issue 1: Missing Initial Bookmark (Original)

**Location:** `pkg/storage/unified/resource/server.go:1454-1463`

```go
// Current implementation - only sends bookmark when BOTH conditions true
if req.SendInitialEvents && req.AllowWatchBookmarks {
    if err := srv.Send(&resourcepb.WatchEvent{
        Type: resourcepb.WatchEvent_BOOKMARK,
        Resource: &resourcepb.WatchEvent_Resource{
            Version: initialEventsRV,
        },
    }); err != nil {
        return err
    }
}
```

**Problem:** Bookmarks only sent when `SendInitialEvents=true`, but default is `false`.

**Impact:** Client-go v0.35+ expects initial bookmark, waits 30 seconds.

### Issue 2: Broadcaster Deadlock (Critical)

**Location:** `pkg/storage/unified/resource/broadcaster.go:204-239`

**Problem:** Unbuffered channels + blocking operations in main loop.

**Impact:** Broadcaster completely stuck, no events sent at all.

---

## Solutions

### Priority 1: Fix Broadcaster Deadlock (CRITICAL)

#### Option A: Make Cache Channels Buffered (Immediate Fix)

**File:** `pkg/storage/unified/resource/broadcaster.go:273-274`

```go
func newChannelCache[T any](ctx context.Context, size int) channelCache[T] {
    c := &localCache[T]{}

    c.ctx = ctx
    if size <= 0 {
        size = defaultCacheSize
    }
    c.size = size
    c.cache = make([]T, c.size)

    // OLD (DEADLOCK):
    // c.add = make(chan T)
    // c.read = make(chan chan T)

    // NEW (FIX):
    c.add = make(chan T, size)           // Buffered
    c.read = make(chan chan T, 10)       // Buffered

    go c.run()

    return c
}
```

**Pros:**
- ✅ Simple one-line change
- ✅ Prevents deadlock in most cases
- ✅ Low risk

**Cons:**
- ⚠️ Still possible to deadlock if buffer fills
- ⚠️ Doesn't address architectural issue

#### Option B: Non-Blocking Cache Operations (Better Fix)

**File:** `pkg/storage/unified/resource/broadcaster.go:285, 353`

```go
func (c *localCache[T]) Add(item T) {
    select {
    case c.add <- item:
        // Success
    default:
        // Cache busy, drop event (acceptable for slow consumer)
    }
}

func (c *localCache[T]) ReadInto(dst chan T) error {
    r := make(chan T, c.size)
    select {
    case c.read <- r:
        // Success, proceed with reading
    case <-c.ctx.Done():
        return c.ctx.Err()
    default:
        return fmt.Errorf("cache busy")
    }

    for item := range r {
        select {
        case dst <- item:
        default:
            return fmt.Errorf("slow consumer")
        }
    }
    return nil
}
```

**Pros:**
- ✅ Eliminates blocking entirely
- ✅ Handles backpressure gracefully
- ✅ Fails fast instead of deadlocking

**Cons:**
- ⚠️ More code changes
- ⚠️ May drop events under extreme load

#### Option C: Separate Subscription Goroutine (Architectural Fix)

**File:** `pkg/storage/unified/resource/broadcaster.go:stream()`

```go
func (b *broadcaster[T]) stream(input <-chan T) {
    defer func() {
        close(b.terminated)
        for _, sub := range b.subs {
            close(sub)
            delete(b.subs, sub)
        }
    }()

    // Channel for registering subscriptions after cache backfill
    registerSub := make(chan chan T, 100)

    for {
        select {
        case <-b.shouldTerminate:
            return

        case sub := <-b.subscribe:
            // Don't block main loop - do cache backfill in separate goroutine
            go func(sub chan T) {
                err := b.cache.ReadInto(sub)
                if err != nil {
                    close(sub)
                    return
                }
                // Register subscription in main loop
                registerSub <- sub
            }(sub)

        case sub := <-registerSub:
            // Add subscription after cache backfill complete
            b.subs[sub] = sub

        case recv := <-b.unsubscribe:
            if sub, ok := b.subs[recv]; ok {
                close(sub)
                delete(b.subs, sub)
            }

        case item, ok := <-input:
            if !ok {
                return
            }
            b.cache.Add(item)
            for _, sub := range b.subs {
                select {
                case sub <- item:
                default:
                    b.unsubscribe <- sub
                }
            }
        }
    }
}
```

**Pros:**
- ✅ Eliminates blocking in main loop entirely
- ✅ Scales better with many concurrent subscriptions
- ✅ Proper separation of concerns

**Cons:**
- ⚠️ More complex change
- ⚠️ Requires careful testing

---

### Priority 2: Add Initial Bookmark Support

**File:** `pkg/storage/unified/resource/server.go:1463`

After the broadcaster deadlock is fixed, add bookmark support:

```go
// Send initial bookmark after SendInitialEvents
if req.SendInitialEvents && req.AllowWatchBookmarks {
    if err := srv.Send(&resourcepb.WatchEvent{
        Type: resourcepb.WatchEvent_BOOKMARK,
        Resource: &resourcepb.WatchEvent_Resource{
            Version: initialEventsRV,
        },
    }); err != nil {
        return err
    }
}

// NEW: Also send initial bookmark for regular watches
// This satisfies client-go v0.35+ requirement for consistent read point
if !req.SendInitialEvents && req.AllowWatchBookmarks {
    bookmarkRV := mostRecentRV
    if req.Since > 0 {
        bookmarkRV = req.Since
    }

    if err := srv.Send(&resourcepb.WatchEvent{
        Type: resourcepb.WatchEvent_BOOKMARK,
        Resource: &resourcepb.WatchEvent_Resource{
            Version: bookmarkRV,
        },
    }); err != nil {
        return err
    }
}
```

---

## Recommended Action Plan

### Phase 1: Immediate Fix (Today)

1. **Apply Option A** - Add buffering to cache channels
   - File: `pkg/storage/unified/resource/broadcaster.go:273-274`
   - Change: `make(chan T)` → `make(chan T, size)`
   - Risk: Low
   - Impact: Prevents most deadlock scenarios

2. **Test in staging** with rolling deployments

3. **Deploy to production**

### Phase 2: Short-term Fix (This Week)

1. **Apply Option B** - Make cache operations non-blocking
   - Files: `broadcaster.go:285, 353`
   - Add `select` with `default` cases
   - Risk: Low-Medium
   - Impact: Eliminates deadlock entirely

2. **Add monitoring**
   - Metric: `broadcaster_cache_drops_total`
   - Metric: `broadcaster_subscription_failures_total`
   - Alert on drops > 0

3. **Test under load** with multiple concurrent watches

### Phase 3: Long-term Fix (Next Sprint)

1. **Apply Option C** - Refactor subscription handling
   - Separate goroutines for subscription setup
   - Risk: Medium
   - Impact: Better scalability, cleaner architecture

2. **Add initial bookmark support** (Priority 2)
   - Satisfies client-go v0.35+ requirements
   - Reduces startup latency

3. **Add comprehensive testing**
   - Concurrent watch subscriptions
   - High event rate scenarios
   - Rolling deployment simulation

### Phase 4: Monitoring & Validation

1. **Deploy to production** with feature flag

2. **Monitor metrics:**
   - Watch subscription success rate
   - Bookmark timeout warnings
   - API server CPU/memory during rollouts
   - Watch latency

3. **Validate during rolling deployments**

---

## Testing Strategy

### Unit Tests

```go
func TestBroadcaster_ConcurrentSubscriptions(t *testing.T) {
    // Test 100 concurrent subscriptions while events are streaming
}

func TestBroadcaster_HighEventRate(t *testing.T) {
    // Test 1000 events/sec with multiple subscribers
}

func TestBroadcaster_NoDeadlock(t *testing.T) {
    // Subscribe during Add() operations
    // Verify no goroutine leaks with runtime.NumGoroutine()
}
```

### Integration Tests

```go
func TestRepositoryController_RollingDeployment(t *testing.T) {
    // Simulate:
    // 1. Controller running with active watch
    // 2. Start second controller
    // 3. Kill first controller
    // 4. Verify second controller receives events
}
```

### Load Tests

```bash
# Create 10 repository watches concurrently
for i in {1..10}; do
  kubectl apply -f repository-$i.yaml &
done

# Monitor for bookmark warnings
kubectl logs -f repository-controller | grep "bookmark expired"
```

---

## References

- **Broadcaster Implementation:** `pkg/storage/unified/resource/broadcaster.go`
- **Watch Implementation:** `pkg/storage/unified/resource/server.go:1357`
- **API Store:** `pkg/storage/unified/apistore/store.go:351`
- **Repository Controller:** `pkg/registry/apis/provisioning/controller/repository.go`
- **Repository Operator:** `pkg/operators/provisioning/repo_operator.go`

### Related Kubernetes Issues

- [KEP-956: Watch Bookmarks](https://github.com/kubernetes/enhancements/tree/master/keps/sig-api-machinery/956-watch-bookmark)
- [client-go v0.35 Watch Changes](https://github.com/kubernetes/client-go/blob/release-0.35/CHANGELOG/CHANGELOG-0.35.md)

### Similar Issues in Grafana

- **SQLite SQLITE_BUSY Deadlocks** (resolved in PR #118805)
  - Root cause: Unbounded connection pool
  - Fix: Limit MaxOpenConn to prevent contention
  - Lesson: Default configurations don't always match production workloads

---

## Conclusion

The bookmark timeout warnings are symptoms of a critical broadcaster deadlock caused by **unbuffered channels and blocking operations in the main event loop**. The issue manifests during rolling deployments when new pods subscribe while the broadcaster is processing high event rates.

**Immediate action required:** Apply Option A (buffered channels) to prevent deadlock.

**Follow-up:** Implement Option B (non-blocking operations) for complete fix.

The missing initial bookmark support is a secondary issue that should be addressed after the deadlock is resolved.
