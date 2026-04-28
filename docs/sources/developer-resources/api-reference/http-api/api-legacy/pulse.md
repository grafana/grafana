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

> Pulse is experimental and is gated behind the `dashboardPulse` feature toggle. The endpoints below return `404` when the toggle is off.

The Pulse API attaches Slack-style threaded conversations to Grafana resources. v1 supports two resource kinds:

- `dashboard` — comments scoped to a dashboard (use the dashboard UID as `resourceUID`)
- `panel` — comments scoped to a single panel (use `<dashboardUID>:<panelID>` as `resourceUID`)

A **thread** has one or more **pulses** (the parent pulse plus any number of replies, one level deep). Pulses are written as a Lexical-compatible JSON AST with a strict node and URL allowlist; the server rejects anything outside the allowlist with `400 invalid body`.

All endpoints require Grafana authentication. Authorization is delegated to the parent dashboard:

- Reading pulses requires `dashboards:read` on the parent dashboard.
- Writing pulses requires `pulse:write` (granted by default to viewers with dashboard read access).
- Deleting another user's pulse requires `pulse:admin`. Authors can always delete their own pulses.

## Body format

A pulse body is a small JSON document. Allowed top-level shape:

```json
{
  "version": 1,
  "root": {
    "type": "root",
    "children": [
      { "type": "paragraph", "children": [
        { "type": "text", "text": "Hello " },
        { "type": "mention", "mention": { "kind": "user", "uid": "u-42" }, "text": "@alice" },
        { "type": "text", "text": ", see " },
        { "type": "mention", "mention": { "kind": "panel", "uid": "abc:3" }, "text": "#cpu" }
      ] }
    ]
  }
}
```

Allowed node `type` values: `root`, `paragraph`, `text`, `linebreak`, `link`, `mention`, `code`. Allowed link schemes: `http`, `https`, `mailto`. Bodies larger than 64 KiB are rejected.

## List threads

`GET /api/pulse/:resourceKind/:resourceUID/threads`

Query parameters:

- `limit` (optional, default 25, max 100)
- `cursor` (optional, opaque cursor from a previous response)
- `unread` (optional, `true` to return only threads with unread pulses for the caller)

**Example response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "items": [
    {
      "uid": "p1a2b3c4d5e6f7",
      "resourceKind": "dashboard",
      "resourceUID": "abc",
      "version": 4,
      "pulseCount": 3,
      "lastPulseAt": "2026-04-28T14:02:00Z",
      "lastAuthor": { "kind": "user", "uid": "u-42", "name": "alice" },
      "preview": "deploy is rolling out, watch the p99..."
    }
  ],
  "nextCursor": "eyJjIjoiMjAyNi0wNC0yOFQxNDowMjowMFoiLCJ1IjoicDFhMmIzYzRkNWU2ZjcifQ=="
}
```

## Create a thread

`POST /api/pulse/:resourceKind/:resourceUID/threads`

**Body:**

```json
{ "body": { "version": 1, "root": { "type": "root", "children": [ ... ] } } }
```

The author is auto-subscribed to the new thread. Any `@user` or `#panel` mentions in the body are persisted and notified.

**Example response:**

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "thread": { "uid": "p1a2b3c4d5e6f7", "version": 1, "pulseCount": 1, ... },
  "pulse":  { "uid": "x9y8z7w6v5u4t3", "threadUID": "p1a2b3c4d5e6f7", ... }
}
```

## Get a thread

`GET /api/pulse/threads/:threadUID`

Returns the thread metadata. Use `List pulses` to fetch the messages.

## List pulses in a thread

`GET /api/pulse/threads/:threadUID/pulses?limit=50&cursor=...`

Pulses are returned in ascending chronological order. The cursor uses `(created, id)` as a stable tiebreaker.

## Add a reply

`POST /api/pulse/threads/:threadUID/pulses`

```json
{ "body": { "version": 1, "root": { ... } } }
```

Replying to a soft-deleted parent pulse returns `409`.

## Edit a pulse

`PATCH /api/pulse/pulses/:pulseUID`

```json
{ "body": { "version": 1, "root": { ... } } }
```

Only the original author may edit. Edits set `edited=true` and bump the thread version.

## Delete a pulse

`DELETE /api/pulse/pulses/:pulseUID`

Soft-deletes the pulse (the row is retained for audit). Author or `pulse:admin` only.

## Subscribe / unsubscribe

`PUT /api/pulse/:resourceKind/:resourceUID/subscription`

`DELETE /api/pulse/:resourceKind/:resourceUID/subscription`

Subscribers receive a notification on every new pulse on the resource.

## Mark read

`POST /api/pulse/threads/:threadUID/read`

```json
{ "lastSeenPulseUID": "x9y8z7w6v5u4t3" }
```

Updates the caller's per-thread read state. Used by the UI to compute unread badges.

## Get resource version

`GET /api/pulse/:resourceKind/:resourceUID/version`

```json
{ "version": 17, "lastActivityAt": "2026-04-28T14:02:00Z" }
```

A monotonic counter that increments on any pulse activity for the resource. Frontends poll this as a fallback when Grafana Live is unreachable.

## Realtime updates

Pulse events are broadcast on `grafana/pulse/:resourceKind/:resourceUID` over Grafana Live. Clients subscribe via the standard Live API; the server refuses all client-initiated publishes on this channel.

Event payload:

```json
{ "action": "thread.created", "threadUID": "...", "pulseUID": "...", "resourceKind": "dashboard", "resourceUID": "abc" }
```

`action` is one of `thread.created`, `pulse.added`, `pulse.edited`, `pulse.deleted`.
