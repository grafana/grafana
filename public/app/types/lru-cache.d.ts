// Type definitions for lru-cache 7.1.0
// TypeScript Version: 4.5
declare class LRUCache<K, V> {
  constructor(options?: LRUCache.Options<K, V>);

  /**
   * Return total length of objects in cache taking into account `length` options function.
   */
  readonly length: number;

  /**
   * Return total quantity of objects currently in cache. Note,
   * that `stale` (see options) items are returned as part of this item count.
   */
  readonly itemCount: number;

  /**
   * Same as Options.allowStale.
   */
  allowStale: boolean;

  /**
   * Same as Options.length.
   */
  lengthCalculator(value: V): number;

  /**
   * Same as Options.max. Resizes the cache when the `max` changes.
   */
  max: number;

  /**
   * Same as Options.maxAge. Resizes the cache when the `maxAge` changes.
   */
  maxAge: number;

  /**
   * Will update the "recently used"-ness of the key. They do what you think.
   * `maxAge` is optional and overrides the cache `maxAge` option if provided.
   */
  set(key: K, value: V, options?: LRUCache.SetOptions<V>): boolean;

  /**
   * Will update the "recently used"-ness of the key. They do what you think.
   * `maxAge` is optional and overrides the cache `maxAge` option if provided.
   *
   * If the key is not found, will return `undefined`.
   */
  get(key: K): V | undefined;

  /**
   * Returns the key value (or `undefined` if not found) without updating
   * the "recently used"-ness of the key.
   *
   * (If you find yourself using this a lot, you might be using the wrong
   * sort of data structure, but there are some use cases where it's handy.)
   */
  peek(key: K): V | undefined;

  /**
   * Check if a key is in the cache, without updating the recent-ness
   * or deleting it for being stale.
   */
  has(key: K): boolean;

  /**
   * Deletes a key out of the cache.
   */
  del(key: K): void;

  /**
   * Clear the cache entirely, throwing away all values.
   */
  reset(): void;

  /**
   * Manually iterates over the entire cache proactively pruning old entries.
   */
  prune(): void;

  /**
   * Just like `Array.prototype.forEach`. Iterates over all the keys in the cache,
   * in order of recent-ness. (Ie, more recently used items are iterated over first.)
   */
  forEach<T = this>(callbackFn: (this: T, value: V, key: K, cache: this) => void, thisArg?: T): void;

  /**
   * The same as `cache.forEach(...)` but items are iterated over in reverse order.
   * (ie, less recently used items are iterated over first.)
   */
  forEach<T = this>(callbackFn: (this: T, value: V, key: K, cache: this) => void, thisArg?: T): void;

  /**
   * Return an array of the keys in the cache.
   */
  keys(): K[];

  /**
   * Return an array of the values in the cache.
   */
  values(): V[];

  /**
   * Return an array of the cache entries ready for serialization and usage with `destinationCache.load(arr)`.
   */
  dump(): Array<LRUCache.Entry<K, V>>;

  /**
   * Loads another cache entries array, obtained with `sourceCache.dump()`,
   * into the cache. The destination cache is reset before loading new entries
   *
   * @param cacheEntries Obtained from `sourceCache.dump()`
   */
  load(cacheEntries: ReadonlyArray<LRUCache.Entry<K, V>>): void;
}

// eslint-disable-next-line no-redeclare
declare namespace LRUCache {
  interface Options<K, V> {
    /**
     * @type {number | undefined}
     * the number of most recently used items to keep.
     * note that we may store fewer items than this if maxSize is hit.
     */
    max?: number | undefined;

    // if you wish to track item size, you must provide a maxSize
    // note that we still will only keep up to max *actual items*,
    // so size tracking may cause fewer than max items to be stored.
    // At the extreme, a single item of maxSize size will cause everything
    // else in the cache to be dropped when it is added.  Use with caution!
    // Note also that size tracking can negatively impact performance,
    // though for most cases, only minimally.
    maxSize?: number | undefined;

    // buffers or other items where memory size depends on the object itself.
    // also note that oversized items do NOT immediately get dropped from
    // the cache, though they will cause faster turnover in the storage.
    // Return an positive integer which is the size of the item,
    // if a positive integer is not returned, will use 0 as the size.
    sizeCalculation?: (value, key) => number;

    // function to call when the item is removed from the cache
    // Note that using this can negatively impact performance.
    dispose?: (value, key) => void;

    /**
     * By default, if you set a `dispose()` method, then it'll be called whenever
     * a `set()` operation overwrites an existing key. If you set this option,
     * `dispose()` will only be called when a key falls out of the cache,
     * not when it is overwritten.
     */
    noDisposeOnSet?: boolean | undefined;

    // max time to live for items before they are considered stale
    // note that stale items are NOT preemptively removed by default,
    // and MAY live in the cache, contributing to its LRU max, long after
    // they have expired.
    // Also, as this cache is optimized for LRU/MRU operations, some of
    // the staleness/TTL checks will reduce performance, as they will incur
    // overhead by deleting items.
    // Must be a positive integer in ms, defaults to 0, which means "no TTL"
    ttl?: number;

    // Minimum amount of time in ms in which to check for staleness.
    // Defaults to 1, which means that the current time
    // is checked at most once per millisecond.
    // Set to 0 to check the current time every time staleness is tested.
    // Note that setting this to a higher value
    // will improve performance somewhat while using ttl tracking,
    // albeit at the expense of keeping stale items
    // around a bit longer than intended.
    ttlResolution?: number;

    // Preemptively remove stale items from the cache.
    // Note that this may significantly degrade performance,
    // especially if the cache is storing a large number of items.
    // It is almost always best to just leave the stale items in the cache,
    // and let them fall out as new items are added.
    // Note that this means that allowStale is a bit pointless,
    // as stale items will be deleted almost as soon as they expire.
    // Use with caution!
    ttlAutopurge?: boolean;

    // By default, if you set ttl, it'll only delete stale items
    // from the cache when you get(key).
    // That is, it's not preemptively pruning items.
    // If you set allowStale:true, it'll return the stale value
    // as well as deleting it. If you don't set this,
    // then it'll return undefined when you try to get a stale entry.
    // Note that when a stale entry is fetched,
    // even if it is returned due to allowStale being set,
    // it is removed from the cache immediately.
    // You can immediately put it back in the cache if you wish,
    // thus resetting the TTL.
    // This may be overridden by passing an options object to cache.get().
    // The cache.has() method will always return false for stale items.
    // Boolean, default false, only relevant if ttl is set.
    allowStale?: boolean;

    // When using time-expiring entries with ttl,
    // setting this to true will make each item's
    // age reset to 0 whenever it is retrieved from cache with get(),
    // causing it to not expire.
    // (It can still fall out of cache based on recency of use, of course.)
    // This may be overridden by passing an options object to cache.get().
    // Boolean, default false, only relevant if ttl is set.
    updateAgeOnGet?: boolean;

    // update the age of items on cache.has(), renewing their TTL
    // boolean, default false
    updateAgeOnHas?: boolean;

    // update the "recently-used"-ness of items on cache.has()
    // boolean, default false
    updateRecencyOnHas?: boolean;

    /**
     * Function that is used to calculate the length of stored items.
     * If you're storing strings or buffers, then you probably want to do
     * something like `function(n, key){return n.length}`. The default
     * is `function(){return 1}`, which is fine if you want to store
     * `max` like-sized things. The item is passed as the first argument,
     * and the key is passed as the second argument.
     */
    length?(value: V, key?: K): number;

    /**
     * By default, if you set a `maxAge`, it'll only actually pull stale items
     * out of the cache when you `get(key)`. (That is, it's not pre-emptively
     * doing a `setTimeout` or anything.) If you set `stale:true`, it'll return
     * the stale value before deleting it. If you don't set this, then it'll
     * return `undefined` when you try to get a stale entry,
     * as if it had already been deleted.
     */
    stale?: boolean | undefined;
  }

  interface SetOptions<V> {
    ttl?: number;
    // Will prevent calling the sizeCalculation function
    // and just use the specified number if it is a positive integer
    size?: number;
    // Same as above
    sizeCalculator?: (value: V) => number;
    // Will prevent calling a dispose function in the case of overwrites
    noDisposeOnSet?: boolean;
  }

  interface Entry<K, V> {
    k: K;
    v: V;
    e: number;
  }
}

declare module 'lru-cache' {
  export = LRUCache;
}
