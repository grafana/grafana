# Text v2 sandbox prototype

Panels with at least one dataframe (including an empty dataframe) render HTML and
Markdown in a sandboxed iframe. Panels without dataframes retain the existing
renderer, sanitizer setting, nested embeds, and Mermaid behavior. Text v1 is unchanged.

`sandboxFrame.ts` owns a single document generation. It mounts a hidden empty shell
with CSP, verifies CSP event delivery using a fixed non-sensitive blocked image,
then inserts sanitized content. Two animation frames delay initial visibility;
this is a presentation optimization, not a security decision. CSP remains enforced
for the document's lifetime. A violation hides the iframe immediately and removes
it after queued events have been collected. A new HTML value or consent policy
creates a fresh document. Applied CSP cannot be relaxed in place.

`TextSandbox` owns temporary origin grants and exposes `renderConsent`, receiving
normalized resources and an `allow` callback. Replace the default alert/button here
with the consent UX. There is no persistent consent storage in this prototype.
Only origins, never blocked URL paths/query strings, are passed to the UI.

Consent enables an origin for images, media, fonts, stylesheets, and nested frames.
Scripts, objects, connections, forms, and base changes remain blocked. Allowing an
embedded document trusts its downstream resources too: the outer CSP cannot
intercept all requests inside a third-party document. Inherited deployment CSP
still applies and cannot be relaxed by consent.

Emotion global styles are copied into the frame. Grafana's trusted font directory
is allowed through `font-src`. Theme changes rebuild the frame. Content height
updates preserve outer scrolling/fit-content and notify pagination measurement.

## Known prototype limits

- WebKit does not deliver the required events in the script-disabled sandbox in
  current testing. The capability check times out without inserting panel data and
  shows an unsupported state. No-data panels do not require this check.
- Protected Mermaid fences display as source. The existing Mermaid renderer uses
  the parent document for intermediate rendering and cannot safely be reused here.
- Late violations can briefly show broken resources before their asynchronous
  callback hides the frame. Forbidden requests are still blocked synchronously.
- Grants last only for the mounted component; edit/remount may request consent
  again. Persistent grants, revocation UX, and dashboard-scoped lifetime belong to
  the consent integration.

## Verification

```sh
yarn jest --runInBand --watch=false public/app/plugins/panel/text/v2
yarn playwright test --config e2e-playwright/text-sandbox.config.ts
yarn typecheck
```

Browser tests exercise the actual controller and intercept network requests;
they need no Grafana server. JSDOM content/editor tests mock only the unsupported
iframe controller. The default test fixture now has zero dataframes; tests for
query behavior provide explicit dataframes.
