Redis client for Golang [![Build Status](https://travis-ci.org/go-redis/redis.png?branch=master)](https://travis-ci.org/go-redis/redis)
=======================

Supports:

- Redis 2.8 commands except QUIT, MONITOR, SLOWLOG and SYNC.
- Pub/sub.
- Transactions.
- Pipelining.
- Connection pool.
- TLS connections.
- Thread safety.
- Timeouts.
- Redis Sentinel.

API docs: http://godoc.org/gopkg.in/redis.v2.
Examples: http://godoc.org/gopkg.in/redis.v2#pkg-examples.

Installation
------------

Install:

    go get gopkg.in/redis.v2

Look and feel
-------------

Some corner cases:

    SORT list LIMIT 0 2 ASC
    vals, err := client.Sort("list", redis.Sort{Offset: 0, Count: 2, Order: "ASC"}).Result()

    ZRANGEBYSCORE zset -inf +inf WITHSCORES LIMIT 0 2
    vals, err := client.ZRangeByScoreWithScores("zset", redis.ZRangeByScore{
        Min: "-inf",
        Max: "+inf",
        Offset: 0,
        Count: 2,
    }).Result()

    ZINTERSTORE out 2 zset1 zset2 WEIGHTS 2 3 AGGREGATE SUM
    vals, err := client.ZInterStore("out", redis.ZStore{Weights: []int64{2, 3}}, "zset1", "zset2").Result()

    EVAL "return {KEYS[1],ARGV[1]}" 1 "key" "hello"
    vals, err := client.Eval("return {KEYS[1],ARGV[1]}", []string{"key"}, []string{"hello"}).Result()
