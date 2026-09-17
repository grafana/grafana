# Frontend service boot script

This directory contains the TypeScript source for the Grafana frontend service boot script which is responsible for:

- fetching boot data from `/bootdata`
- handles session expiry and token rotation
- applies theme
- handles SSO auto-login redirects

## How it's used by the backend

The `IndexProvider` (`pkg/services/frontend/index.go`) inlines the script into the HTML response it serves. At startup, the backend reads `boot.js` from both build directories, `public/build` and `public/build/rspack`, and keeps each one as a `template.JS` value. It then injects one of them into the `<script>` tag in `index.html`. The `grafana.rspackBuild` feature flag selects which build directory the script comes from.

## How it's built

Each bundler builds its own copy from `public/boot/index.ts`:

- webpack builds `public/build/boot.js` from a separate entry point named `boot`. The standard frontend build produces it.
- rspack builds `public/build/rspack/boot.js` from its own config, `scripts/rspack/rspack.boot.ts`. `yarn build:rspack` and the rspack dev commands build it first. To build only this file, run `yarn build:rspack:boot`.

The rspack config is separate because the main rspack build emits ES modules. The backend inlines this file into a classic `<script>` tag, so the file must be one self-contained IIFE with no `import` or `export`.
