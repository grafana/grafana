# Frontend service boot script

This directory contains the TypeScript source for the Grafana frontend service boot script which is responsible for:

- fetching boot data from `/bootdata`
- handles session expiry and token rotation
- applies theme
- handles SSO auto-login redirects

## How it's used by the backend

The script is inlined into the HTML response served by the `IndexProvider` (`pkg/services/frontend/index.go`). At startup, the backend reads `public/build/boot.js` from disk and stores it as a `template.JS` value. It is then injected directly into the `<script>` tag in `index.html`.

This is currently enabled via the `compiledBootScript` feature flag.

## How it's built

`public/boot/index.ts` is a separate webpack entry point named `boot`. Run the standard frontend build to produce it.
