---
aliases:
  - ../../../http_api/pulse/ # /docs/grafana/next/http_api/pulse/
  - ../../../developers/http_api/pulse/ # /docs/grafana/next/developers/http_api/pulse/
canonical: https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/api-legacy/pulse/
description: Grafana Pulse HTTP API
keywords:
  - grafana
  - http
  - documentation
  - api
  - pulse
  - comments
  - threads
labels:
  products:
    - enterprise
    - oss
    - cloud
title: 'Pulse HTTP API'
---

# Pulse API

{{< docs/shared lookup="developers/deprecated-apis.md" source="grafana" version="<GRAFANA_VERSION>" >}}

> Pulse is experimental and is gated behind the `dashboardPulse` feature toggle. Every endpoint below returns `404 Not Found` when the toggle is disabled, even for authenticated callers.

The Pulse API attaches Slack-style threaded conversations to Grafana resources. v1 supports a single resource kind:

- `dashboard` — comments scoped to a dashboard. Use the dashboard UID as `resourceUID`.

A **thread** has one or more **pulses**. The first pulse is the parent; replies are one level deep. Pulse bodies are stored as a small Lexical-compatible JSON AST plus an optional `markdown` source. The server enforces a strict allowlist on the AST and renders the markdown through the same sanitizer Grafana uses for Markdown panels — so any `pulse.body` returned by the API is safe to drop into the standard Grafana renderer client-side.

## Authentication and authorization

All endpoints require Grafana authentication. Each route checks two things:

1. A **Pulse RBAC action** appropriate to the verb:
   - `pulse:read` — list/get threads, list pulses, subscribe/unsubscribe, mark read, get resource version
   - `pulse:write` — create thread, add pulse, edit pulse, close own thread
   - `pulse:delete` — delete own pulse, delete own thread
   - `pulse:admin` — delete other users' pulses or threads, reopen any thread
2. **`dashboards:read`** on the parent dashboard.

OSS Grafana grants `pulse:read`, `pulse:write`, and `pulse:delete` to every org role by default (Viewer, Editor, Admin), so any authenticated user that can view a dashboard can comment on it. `pulse:admin` is granted to org Admin and Grafana server admin only. These defaults are exposed through the standard fixed-role machinery — administrators can override them via custom roles or by editing role grants the same way they do for any other built-in role group.

The thread author is **always** allowed to edit, delete, or close their own pulses and threads regardless of `pulse:admin`. Reopening a closed thread requires `pulse:admin`.

## Body format

A pulse body is a small JSON document. The two top-level fields are `root` (the AST, required) and `markdown` (the source the composer authored, optional). The renderer prefers `markdown` when present and falls back to walking the AST otherwise.

```json
{
  "markdown": "Hello `@alice`, see `#cpu`.",
  "root": {
    "type": "root",
    "children": [
      { "type": "paragraph", "children": [
        { "type": "text", "text": "Hello " },
        { "type": "mention", "mention": { "kind": "user", "targetId": "42", "displayName": "alice" }, "text": "@alice" },
        { "type": "text", "text": ", see " },
        { "type": "mention", "mention": { "kind": "panel", "targetId": "abc:3", "displayName": "cpu" }, "text": "#cpu" },
        { "type": "text", "text": "." }
      ] }
    ]
  }
}
```

Allowed AST node `type` values: `root`, `paragraph`, `text`, `linebreak`, `link`, `mention`, `code`, `quote`. Allowed link schemes: `http`, `https`, `mailto`. Bodies larger than the configured cap (32 KiB by default) are rejected with `400 invalid body`. The `markdown` field has its own cap and may be omitted.

Mentions carry both metadata (`kind`, `targetId`) and a human-readable `text` — the backend uses `targetId` to fan out notifications and the frontend uses `text` to render chips. `kind` is `user` or `panel`.

## List threads

`GET /api/pulse/threads`

Query parameters:

| Name | Description |
| ---- | ----------- |
| `resourceKind` | Required. `dashboard` for v1. |
| `resourceUID`  | Required. Dashboard UID. |
| `panelId`      | Optional. Numeric panel ID — when present, returns only panel-scoped threads. Omit to include all threads on the dashboard. |
| `limit`        | Optional. Default 25, max 100. |
| `cursor`       | Optional. Opaque cursor returned by a previous response. |

**Example response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "items": [
    {
      "uid": "p1a2b3c4d5e6f7",
      "orgId": 1,
      "resourceKind": "dashboard",
      "resourceUID": "abc",
      "title": "Deploy is rolling out",
      "createdBy": 42,
      "created": "2026-04-28T13:55:00Z",
      "updated": "2026-04-28T14:02:00Z",
      "lastPulseAt": "2026-04-28T14:02:00Z",
      "pulseCount": 3,
      "version": 4,
      "closed": false,
      "previewBody": { "root": { "type": "root", "children": [ ... ] }, "markdown": "Deploy is rolling out..." },
      "authorName": "Alice Example",
      "authorLogin": "alice",
      "authorAvatarUrl": "/avatar/9c..."
    }
  ],
  "nextCursor": "eyJjIjoiMjAyNi0wNC0yOFQxNDowMjowMFoiLCJ1IjoicDFhMmIzYzRkNWU2ZjcifQ==",
  "hasMore": true
}
```

## Create a thread

`POST /api/pulse/threads`

The `resourceKind` and `resourceUID` are part of the request body, not the path. The author is auto-subscribed to the new thread; any `@user` or `#panel` mentions in the body are persisted in the mention index and trigger notifications.

**Body:**

```json
{
  "resourceKind": "dashboard",
  "resourceUID": "abc",
  "panelId": 3,
  "title": "Optional override; auto-derived from first sentence if omitted",
  "body": { "root": { "type": "root", "children": [ ... ] }, "markdown": "..." }
}
```

**Example response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "thread": { "uid": "p1a2b3c4d5e6f7", "version": 1, "pulseCount": 1, ... },
  "pulse":  { "uid": "x9y8z7w6v5u4t3", "threadUID": "p1a2b3c4d5e6f7", ... }
}
```

## Get a thread

`GET /api/pulse/threads/:threadUID`

Returns the thread metadata plus the populated preview/author fields used by the list view. Use `List pulses in a thread` to fetch the messages.

## List pulses in a thread

`GET /api/pulse/threads/:threadUID/pulses?limit=50&cursor=...`

Pulses are returned in ascending chronological order. The cursor uses `(created, id)` as a stable tiebreaker so deduplication is safe across restarts.

## Add a reply

`POST /api/pulse/threads/:threadUID/pulses`

```json
{ "body": { "root": { ... }, "markdown": "..." }, "parentUID": "x9y8z7w6v5u4t3" }
```

`parentUID` is optional — when omitted the reply attaches to the thread's parent pulse. Replying to a soft-deleted parent or to a closed thread returns `409 Conflict`.

## Edit a pulse

`PATCH /api/pulse/pulses/:pulseUID`

```json
{ "body": { "root": { ... }, "markdown": "..." } }
```

Only the original author may edit. Edits set `edited=true` on the pulse and bump the thread version so other clients can re-render. Editing a soft-deleted pulse returns `410 Gone`.

## Delete a pulse

`DELETE /api/pulse/pulses/:pulseUID`

Soft-deletes the pulse — the row is retained for audit but the body is omitted from list responses. Authorization: the original author or any user with `pulse:admin`.

## Delete a thread

`DELETE /api/pulse/threads/:threadUID`

Hard-deletes the thread plus all its pulses, mention rows, subscriptions, and read-state markers. Authorization: the thread author or any user with `pulse:admin`.

## Close a thread

`POST /api/pulse/threads/:threadUID/close`

Marks the thread as read-only — replies and edits return `409 Conflict`. The history remains visible. Authorization: the thread author or `pulse:admin`.

## Reopen a thread

`POST /api/pulse/threads/:threadUID/reopen`

Clears the `closed` flag. Authorization: `pulse:admin` only — the original close decision is treated as final unless an admin overrides.

## Subscribe / unsubscribe

`POST /api/pulse/threads/:threadUID/subscribe`

`POST /api/pulse/threads/:threadUID/unsubscribe`

Subscribers receive a notification on every new pulse on the thread. The thread author is auto-subscribed when they create the thread or post their first reply.

## Mark read

`POST /api/pulse/threads/:threadUID/read`

```json
{ "lastReadPulseUID": "x9y8z7w6v5u4t3" }
```

Updates the caller's per-thread read state. Used by the UI to compute unread badges. The endpoint is idempotent; clients can call it on every drawer open.

## Get resource version

`GET /api/pulse/resources/:kind/:uid/version`

```json
{
  "resourceKind": "dashboard",
  "resourceUID": "abc",
  "version": 17,
  "lastPulseAt": "2026-04-28T14:02:00Z"
}
```

A monotonic counter that increments on any pulse activity for the resource. Frontends poll this every 10 seconds as a fallback when Grafana Live is unreachable; when it changes they re-fetch the thread list.

## Realtime updates

Pulse events are broadcast on `grafana/pulse/<resourceKind>/<resourceUID>` over Grafana Live. Clients subscribe via the standard Live API; the server refuses all client-initiated publishes on this channel.

Event payload:

```json
{
  "action": "thread_created",
  "orgId": 1,
  "resourceKind": "dashboard",
  "resourceUID": "abc",
  "threadUID": "p1a2b3c4d5e6f7",
  "pulseUID": "x9y8z7w6v5u4t3",
  "authorUserId": 42,
  "at": "2026-04-28T14:02:00.123Z"
}
```

`action` is one of `thread_created`, `thread_deleted`, `thread_closed`, `thread_reopened`, `pulse_added`, `pulse_edited`, `pulse_deleted`. Bodies are intentionally not included in the event — clients refetch via HTTP after seeing an event. This keeps the channel small and avoids leaking content to subscribers whose permissions may have changed since they connected.
