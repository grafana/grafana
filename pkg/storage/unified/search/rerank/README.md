# Configure reranker hedging

Set `hedge_delay` to control when a slow reranking request starts a second attempt.
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
Set `hedge_delay = 0` to allow only one attempt; negative durations do the same.
Provider SDK retries remain disabled.

A positive delay starts a duplicate if the first request is still pending and time remains.
If the first request fails sooner with a retryable provider error, the second attempt starts immediately.
Authentication and validation errors do not trigger an immediate retry.
Grafana makes at most two attempts in total.
Each successful response must include a valid score for every input.
The first complete, valid response wins, and Grafana cancels the other request without waiting.
Reranking still has a five-second limit, or an earlier request deadline.
If the delay reaches that deadline, no timed duplicate starts; an immediate retry can still run while time remains.
