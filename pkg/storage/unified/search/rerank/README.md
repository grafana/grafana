# Configure reranker hedging

Set `hedge_delay` to control when a slow reranking request starts one duplicate request.
The setting applies to both Vertex and Bedrock rerankers.

## Set the delay

Add a Go duration to your custom configuration:

```ini
[vector_reranker]
hedge_delay = 750ms
```

You can also set `GF_VECTOR_RERANKER_HEDGE_DELAY=750ms` in the server environment.
Restart the server that runs search to apply the change.

The default is `500ms` when the setting is absent, empty, or invalid.
Set `hedge_delay = 0` to disable duplicate requests; negative durations also disable them.
Disabling duplicates does not enable provider SDK retries.

A positive delay starts one duplicate only while the first request is pending and time remains.
The first valid result wins, and Grafana cancels the other request.
Reranking still has a five-second limit, or an earlier request deadline.
If the delay reaches that deadline, only the first request runs.
