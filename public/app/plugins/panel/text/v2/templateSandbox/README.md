# Handlebars execution sandbox

Text v2 compiles user-authored Handlebars templates at runtime without `unsafe-eval`.
The panel and editor preview use `useTemplateContent`; no dashboard marker or migration is
required. Plain text, code mode, and disabled template features do not create an execution frame.

## Execution

The existing `?text-panel-runtime` loader bundles the runtime as an IIFE string. The client is
loaded lazily. There is no new HTML file, server route, or bundler entry.

The client creates a hidden `srcdoc` iframe with `allow-scripts` and no `allow-same-origin`.
Its CSP permits only nonce-bearing scripts and denies fetch/XHR, nested frames, forms, and
resource loads. It reuses Grafana's script nonce because `srcdoc` inherits the parent CSP;
when there is no server nonce, it generates one for the frame's own policy.

Inside the frame, `Handlebars.precompile(template)` generates JavaScript without evaluating
it. A temporary script carrying the nonce registers the specification with `Handlebars.template`.
The script is removed immediately. Only the most recent compiled template is cached. Neither
user-authored HTML nor rendered output is inserted into this frame's DOM.

The private Trusted Types policies are `grafana-text-template-shell` for the application-built
shell and `grafana-text-template` for generated script. The latter accepts template text and
compiles it internally; callers cannot submit JavaScript or an AST. Deployments that restrict
Trusted Types policy names must allow these names as well as the existing Text HTML policies.

## Data and helpers

The parent builds the same Once or Per-row context and drives the existing row windows and
truncation limits. The frame registers pure helpers locally. `date`, `variable`, and
`variableValue` require Grafana state, so the frame requests their values through a bounded
bridge. A missing helper result suspends rendering; the parent resolves it using the existing
Grafana functions and retries the template. Results are cached for that render pass, including
across its rows. Dynamic helper arguments and subexpressions are supported.

The runtime reports whether the template actually accessed `data` or `frames[].data`, so a
large unused query does not incorrectly trigger the row-truncation warning. The parent applies
Grafana macro/variable interpolation, Markdown processing, and the existing sanitization after
Handlebars. The visible HTML sandbox and its consent behavior are unchanged.

## Boundary and lifetime

Both directions validate protocol, source window, origin, channel, and payload shape. Requests
accept only template strings and structured-cloneable context. The parent bridge accepts only
the three named helpers with bounded primitive/date arguments and string/string-array results.
Responses are correlated by request id. Cancellation drops late results; unmount removes the
frame. Initialization or request timeout disposes the frame, which can be recreated next render.

Limits: 1,000,000 template/output characters, 8,000,000 serialized message characters, 4,096
helper values per render pass, and five seconds for initialization or each row request. The
existing parent limits remain 1,000 rows and 100,000 rendered characters. Output beyond the
transport limit fails instead of being silently delivered. These bounds are not a CPU quota:
a same-thread iframe cannot be interrupted while synchronous compilation/rendering is running.
A template with many distinct host-helper calls also incurs repeated render passes.
Handlebars remains trusted code: this is not a general JavaScript sandbox. In particular,
resource CSP does not itself prohibit a compromised runtime from navigating its own frame;
the compiler must never turn template text into arbitrary author-controlled JavaScript.

Changes to the compiler, policies, helper bridge, or message validation require security review
under the Text sandbox's `SANDBOX.md` guidance.

## Verification

Run the real Rspack/iframe runtime under response CSP, with and without Trusted Types:

```sh
node node_modules/@playwright/test/cli.js test --config playwright.handlebars-sandbox.config.ts
```

The fixture uses native Handlebars compilation as an explicit negative control. Production
runtime does not intentionally generate CSP violations. Chromium, Firefox, and WebKit cover
compilation, edits, caching, nested helpers, row-access tracking, cancellation, isolation,
forged messages, nonce failures, size limits, disposal, and supported Trusted Types sinks.

React tests mock only the transport and exercise panel/editor integration. Rendering/helper
unit tests use a native reference compiler.
