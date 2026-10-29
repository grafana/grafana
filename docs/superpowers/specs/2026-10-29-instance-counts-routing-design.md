---
title: Instance counts and routing in Alert rule rows
date: 2026-10-29
issue: https://github.com/grafana/alerting-squad/issues/2312
pr: grafana/grafana (PR 3 of 4 in the full-row series)
---

## Overview

Adds per-state instance counts and routing information to the GMA-only Alert rule rows, behind `alerting.gmaOnlyListView`. Both pieces land in the existing meta strip. No new layout primitives are needed.

## Layout

Instance counts and routing join the existing meta strip in this order:

```
datasources | counts | labels | routing
```

All meta items are omitted when absent. The strip already handles falsy entries via `RuleListItem`.

## Instance counts — `RuleInstanceCounts`

### Data

Six new fields added to `ALERT_RULE_FIELDS` in `alertRuleSearchQuery.ts`:

```
totalsHealthy  totalsFiring  totalsPending
totalsRecovering  totalsNoData  totalsError
```

These are retrieve-only (no filter support). Each is an optional number populated only when `alerting.ruleStatusSync` is on.

Added to `AlertRuleSearchHit` and the zod schema in `alertRuleSearchHit.ts` as optional numbers, each with `.optional().catch(undefined)` so a missing or malformed field degrades gracefully instead of failing the whole hit.

### Display

Coloured text badges, one per state that has a non-zero count. States with 0 or missing totals are omitted entirely — never shown as zero.

| State      | Colour |
| ---------- | ------ |
| firing     | red    |
| pending    | orange |
| healthy    | green  |
| recovering | blue   |
| no data    | grey   |
| error      | red    |

The icon (`layers-alt`) and all badges are wrapped in a single `<a>` element linking to the rule's instances tab: `grafanaRulesNav.viewLink(uid) + ?tab=instances`. One link, no redundant per-badge links.

If all totals fields are absent (flag off or not yet synced), the component returns null.

## Routing — `RuleRouting`

### Data

Three new fields added to `ALERT_RULE_FIELDS`:

```
notificationType   receiver   routingTree
```

`notificationType` is `'SimplifiedRouting' | 'NamedRoutingTree'`. `receiver` and `routingTree` are optional strings.

### Display

Three cases, keyed on `notificationType`:

| Case                              | Rendered as                                                                         |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| `SimplifiedRouting`               | `@ Delivered to {receiver}` — receiver is a link via `createContactPointSearchLink` |
| `NamedRoutingTree` with a name    | `@ Policy: {name}` — plain text, no link                                            |
| `NamedRoutingTree` without a name | `@ Default policy` — plain text                                                     |

If `notificationType` is absent, nothing is rendered.

Icon: `at`.

## Files changed

| File                                   | Change                                                 |
| -------------------------------------- | ------------------------------------------------------ |
| `alert-rules/alertRuleSearchQuery.ts`  | Add 9 fields to `ALERT_RULE_FIELDS`                    |
| `alert-rules/alertRuleSearchHit.ts`    | Add fields to zod schema and `AlertRuleSearchHit` type |
| `rule-row/RuleInstanceCounts.tsx`      | New component                                          |
| `rule-row/RuleInstanceCounts.test.tsx` | New tests                                              |
| `rule-row/RuleRouting.tsx`             | New component                                          |
| `rule-row/RuleRouting.test.tsx`        | New tests                                              |
| `alert-rules/AlertRuleRow.tsx`         | Wire both into `meta` array                            |
| `alert-rules/AlertRuleRow.test.tsx`    | Add cases for counts and routing                       |

## Test coverage

**`RuleInstanceCounts`**

- All six states rendered when present
- States with 0 or absent totals omitted
- Entire block is a link to the instances tab
- Returns null when all totals absent

**`RuleRouting`**

- Simplified routing renders "Delivered to" with a contact-point link
- Named routing tree renders "Policy: {name}"
- Default routing tree renders "Default policy"
- Returns null when `notificationType` absent

**`AlertRuleRow`**

- Counts and routing appear in the meta strip
- Counts absent when no totals fields present
- Routing absent when `notificationType` absent

## Out of scope

- State-level filtering in the instances tab URL (all counts link to the same tab)
- Recording rule rows (no instance counts or routing)
- Actions, Edit, sequence pill (#1761)
