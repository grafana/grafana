# Text v2 iframe runtime

All Text v2 HTML and Markdown use the same iframe runtime. With any dataframe
(including a zero-row frame), the iframe has an opaque origin, sandbox restrictions,
and a restrictive custom CSP. With no dataframes, both the sandbox attribute and
custom CSP are omitted. The administrator's sanitizer setting still applies to
no-data content; Text v1 is unchanged.

## Lifecycle

`SandboxFrame.tsx` owns a keyed document generation, height, and the
message listener through React state and effects. It mounts a visible empty shell before
sending panel content. The protected runtime first verifies CSP violation delivery
using a fixed, non-sensitive blocked image. Only then does the parent send content.
The frame must be connected to load; a detached iframe cannot perform this check.

The child runtime renders content inside its own document. When Mermaid is enabled
and diagram blocks exist, it requests the separate Mermaid runtime from the parent.
The parent lazy-loads and caches that fixed application bundle, then sends its source
only to the requesting document generation. The child executes it with the bootstrap
nonce and renders diagrams in its own realm. Panel scripts remain blocked; no script
origin, connection permission, or eval exception is added to CSP.

Both webpack and Rspack use the same loader for the two self-contained bundles.
The base runtime is approximately 3.5 KB minified. The Mermaid runtime is approximately
3.45 MB before transfer compression, downloaded once per application session and
executed only in frames that need diagrams. Plain text panels never request it.

One cancellable task yields before reporting rendering completion; offscreen
cross-origin documents can suspend animation frames indefinitely. CSP blocks requests
synchronously throughout the document's lifetime. Violations batch normalized reports
to the parent without hiding or removing the iframe. Permitted content, resizing,
and Mermaid continue, and later violations are collected too.
HTML, theme, protection mode, or origin-grant changes create a
fresh document; an applied CSP cannot be relaxed in place.

Messages are checked against the current WindowProxy, expected origin, protocol,
and per-generation channel. The child accepts one render command from its parent.
A watchdog reports an error if initialization or diagram loading stalls, without
removing the frame. Unverified frames never receive panel content. Failed bundle
loads can be retried by later generations; late responses cannot reach replaced
frames. Cleanup removes listeners,
observers and timers. React StrictMode and stale generations
are covered by tests.

## Reporting and remediation integration

`TextSandbox` owns temporary origin grants and exposes an optional `onStateChange`
callback. Reports contain `state`, `canAllow`, and `allow`. State tracks lifecycle
(`loading`, `ready`, or `error`) independently from accumulated `resources`.
Rendering completion and errors preserve violations. A fresh document resets them.
The callback receives `undefined` when its document or consumer is removed, so a
future dashboard consumer can clear its report. Old snapshot callbacks are inert.
`allow` is available only when every violation can be relaxed, and applies only the
origins captured in that snapshot by creating a fresh document.

There is no panel-scoped loading, error, or consent UI. Browser-native failed resources
may remain visible alongside permitted content. Dashboard reporting, remediation UX,
and persistent consent belong to a follow-up PR; this PR only exposes the local callback.
Only origins, never blocked URL paths or query strings, are sent to the UI.

Consent enables an origin for images, media, fonts, stylesheets, and nested frames.
Panel scripts, objects, connections, forms, and base changes remain blocked.
Allowing an embedded document trusts its downstream resources too: the outer CSP
cannot intercept all requests inside a third-party document. Inherited deployment
CSP still applies and cannot be relaxed by consent.

## Styling, Mermaid, and compatibility

Emotion global styles and the theme's Mermaid configuration are copied into the
frame. Trusted application font assets are embedded as data URLs because the
opaque document cannot load fonts without CORS headers. Only fixed font URLs in
application-owned CSS, under Grafana's font directory, are fetched by the parent;
panel content never enters that path.

Mermaid executes entirely inside the child realm, with strict security and HTML
labels disabled. Generated SVG is sanitized before insertion. Its resource loads
remain subject to the same CSP and consent flow as other panel content.

The child ResizeObserver reports content dimensions; React controls iframe height
and notifies pagination without accessing the opaque document. A no-data frame
has no custom security restrictions, but moving content into any iframe changes
its document/window realm. Scripts depending on parent globals, surrounding page
selectors, or navigation behavior may require changes. Deployment CSP is still
inherited even when custom CSP is omitted.

## Known prototype limits

- Failed resources may appear broken; forbidden requests are blocked before transmission.
- Grants last only for the mounted component. Persistent grants, revocation UX,
  and dashboard-scoped lifetime belong to the consent integration.
- The self-contained Mermaid bundle is relatively large and is instantiated per
  diagram-bearing frame. Plain HTML/Markdown frames do not incur this cost.

## Verification

```sh
yarn jest --runInBand --watch=false public/app/plugins/panel/text/v2
yarn playwright test --config e2e-playwright/text-sandbox.config.ts
yarn typecheck
```

Browser tests use the actual React component under StrictMode in Chromium,
Firefox, and WebKit. They cover Mermaid, deployment nonces, blocked requests,
consent, late violations, resizing, refresh, legacy embeds/scripts, and cleanup.
JSDOM content/editor tests mock only the unsupported iframe component; dedicated
component tests validate message filtering, generation changes, and timeouts.
