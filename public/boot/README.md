# Frontend service boot script

This directory contains the TypeScript source for the Grafana frontend service boot script which is responsible for:

- fetching boot data from `/bootdata`
- handles session expiry and token rotation
- applies theme
- handles SSO auto-login redirects

## How it's used by the backend

The `IndexProvider` (`pkg/services/frontend/index.go`) inlines the script into the HTML response it serves. At startup, the backend reads `public/build/boot.js` and keeps it as a `template.JS` value. It then injects it into the `<script>` tag in `index.html`. Startup fails if the file is missing.

## How it's built

rspack builds `public/build/boot.js` from `public/boot/index.ts` with its own config, `scripts/rspack/rspack.boot.ts`. `yarn build` and the dev commands build it first. To build only this file, run `yarn build:boot`.

The config is separate because the main rspack build emits ES modules. The backend inlines this file into a classic `<script>` tag, so the file must be one self-contained IIFE with no `import` or `export`.
