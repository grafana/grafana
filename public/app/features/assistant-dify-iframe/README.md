# Grafana Assistant (Dify iframe)

Third assistant variant: embeds the **native Dify chatbot UI** in a Grafana-styled sidebar shell.

| Toolbar icon | Assistant |
| --- | --- |
| Sparkle | Local keyword assistant |
| Message | Dify API (custom Grafana UI + voice) |
| Window | **Dify iframe (this folder)** |

## Setup

1. In [Dify Cloud](https://cloud.dify.ai): open your app → **Publish** → **Embed** → copy the **embed token** (not the API key).

2. Add to `.dify.env`:

```bash
DIFY_EMBED_TOKEN=your-embed-token-here
# optional overrides:
# DIFY_EMBED_BASE=https://udify.app
# DIFY_EMBED_URL=https://udify.app/chatbot/your-token
```

3. Start the proxy (serves `/embed-config`):

```bash
node scripts/assistant-dify-proxy.mjs
```

4. Run Grafana (`make run` + `yarn start`).

## UI notes

- The **outer shell** (header, width, borders) matches the other Grafana Assistant panels.
- The **chat UI inside the iframe** is Dify’s own — it cannot be fully restyled from Grafana due to browser sandboxing.
- Use **sync** in the header to reload the iframe (new conversation).
- Theme query param (`?theme=dark|light`) is appended when Dify supports it.
