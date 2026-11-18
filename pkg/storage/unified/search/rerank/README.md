# Configure reranker hedging

Set `hedge_delay` to control when a slow reranking request starts a duplicate SDK call.
The setting applies to both Vertex and Bedrock rerankers.

## Set the delay

Add a Go duration to your custom configuration:

```ini
[vector_reranker]
hedge_delay = 750ms
```

You can also set `GF_VECTOR_RERANKER_HEDGE_DELAY=750ms` in the server environment when your configuration includes a `[vector_reranker]` section.
Restart the server that runs search to apply the change.

The default is `500ms` when the setting is absent, empty, or invalid.
Set `hedge_delay = 0` to disable the duplicate; negative durations do the same.
SDK retries remain available when duplication is disabled.

A positive delay starts one duplicate SDK call if the first call is still pending and time remains.
If the first call enters SDK retry handling before the duplicate starts, Grafana suppresses the duplicate for that request.
An already started duplicate continues, and either call can return the first complete, valid result.
Grafana cancels the other call without waiting.

The SDK decides which errors to retry and applies its own backoff.
Grafana makes at most two SDK calls, including the duplicate.
Vertex makes at most two SDK attempts per call, or four if the duplicate starts.
Bedrock uses its configured AWS retry limit: the default is three attempts per call, or six if the duplicate starts.
A custom Bedrock retryer can set a different limit; a limit of zero has no attempt-count bound but still follows the shared deadline.
Transparent transport retries are outside the Vertex SDK attempt limit.
Each successful response must include a valid score for every input.

Both calls share a five-second limit, or an earlier request deadline.
SDK backoff uses that same time budget.
If the delay reaches the deadline, no duplicate starts.
