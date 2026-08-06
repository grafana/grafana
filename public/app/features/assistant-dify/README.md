# Grafana Assistant (Dify)

Same Grafana Assistant UI as `features/assistant`, backed by **Dify** for chat answers and **speech-to-text** (voice).

The original keyword assistant is unchanged. This folder adds a second sidebar opened from the **message** toolbar icon.

## Why not an iframe?

Dify’s embed/iframe ships its own chat UI. To keep the **exact** Grafana Assistant look, we call Dify’s HTTP APIs (`/chat-messages`, `/audio-to-text`) from a local proxy and render replies in our panel.

## Setup

1. Create a free account / app at [cloud.dify.ai](https://cloud.dify.ai)
2. Create a **Chatbot** app and enable **Speech-to-text** in the app features
3. Copy the app **API Key**
4. In the Grafana repo root:

```bash
cp .dify.env.example .dify.env
# edit .dify.env and set DIFY_API_KEY=app-...
```

5. Start the proxy (keeps the key off the browser):

```bash
node scripts/assistant-dify-proxy.mjs
```

6. Run Grafana as usual (`./bin/grafana server` + `yarn start`)

## Use it

1. Open http://localhost:3000
2. Click the **message** icon in the top bar (next to the sparkle / basic Assistant)
3. Type a question, or click the **mic** for voice
4. Dify answers in the same sidebar UI
