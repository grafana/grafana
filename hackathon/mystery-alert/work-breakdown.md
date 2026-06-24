# Work breakdown — The Mystery Alert

## Milestones

| Day | Milestone | Demoable output |
| --- | --- | --- |
| 1 | Form validation + Assistant stub | Cannot save rule without summary/description; Assistant returns mock text from query |
| 2 | Explain button + drawer | Firing instance → Explain → see generated context |
| 3 | Persist context to rule | "Add this context to the alert" updates rule annotations |
| 4 | Polish + bonus | IRM check-in, bulk filter, or provisioning export |

---

## Workstreams

### Frontend validation — Lauren

| Task | Priority | Status |
| --- | --- | --- |
| Add Summary field to alert rule form (`annotations.summary`) | Must | |
| Add Description field to alert rule form (`annotations.description`) | Must | |
| Form validation: block save when empty | Must | |
| Helper text / links to docs | Should | |
| Wire save-time generation hook (calls Assistant API) | Bonus | |
| Bulk filter: missing/short annotations on rules list | Bonus | |

**Likely files**

- `public/app/features/alerting/unified/` — rule form components
- `packages/grafana-alerting/` — shared form types/schemas

---

### Assistant tool — Pepe

| Task | Priority | Status |
| --- | --- | --- |
| Tool: generate summary + description from query, labels, annotations | Must | |
| Tool: read notification history for a rule | Should | |
| Tool: read IRM history for related incidents | Bonus | |
| Tool: find similar alerts (query/label similarity) | Should | |
| Tool: analyse query quality (too broad, missing filters) | Stretch | |
| Tool: consolidate incident context for rule improvement | Bonus | |

**Inputs**

```json
{
  "ruleUid": "abc123",
  "title": "High CPU",
  "queries": [],
  "labels": {},
  "annotations": {},
  "includeNotificationHistory": true,
  "includeIrmHistory": true,
  "includeSimilarAlerts": true
}
```

**Outputs**

```json
{
  "summary": "CPU usage above 90% on {{ $labels.instance }}",
  "description": "The node has sustained high CPU for 10 minutes...",
  "sources": ["query", "similar_alert:xyz"],
  "isLikelyUseless": false,
  "recurrenceHint": "Fired 12 times in the last 7 days"
}
```

---

### Explain UI — TBD

| Task | Priority | Status |
| --- | --- | --- |
| Explain button on alert instance view | Must | |
| Drawer component for Assistant output | Must | |
| Loading and error states | Must | |
| **Add this context to the alert** CTA | Must | |
| Show impact evaluation signals (recurring, similar alerts) | Should | |
| Add Explain output to notification template (bonus) | Bonus | |

**Likely files**

- Alert instance / alert detail views under `public/app/features/alerting/unified/`
- New drawer component in alerting feature folder

---

### IRM integration — TBD

| Task | Priority | Status |
| --- | --- | --- |
| "Was this alert useful?" at incident resolution | Bonus | |
| Link IRM incident context on alert instance | Bonus | |
| No → trigger Assistant rule improvement flow | Bonus | |
| Suggest Alert or SLO after incident | Stretch | |

---

## API / integration sketch

```
POST /api/alerting/assistant/explain
  → { ruleUid, instanceLabels?, options }

PATCH /api/ruler/grafana/api/v1/rules/{namespace}/{group}
  → update annotations on accept

GET  /api/alerting/rules?filter=missing_annotations
  → bulk identification (hackathon endpoint or client-side filter)
```

Exact endpoints TBD based on existing Assistant and ngalert APIs.

---

## Definition of done (hackathon)

### Must have demo

- [ ] New UI-created alert rules require summary and description
- [ ] Firing alert instance has **Explain** button
- [ ] Explain produces summary and description from query context
- [ ] User can apply generated context back to the alert rule

### Bonus demo

- [ ] Save-time auto-generation when fields are empty
- [ ] Export updated rule for provisioning
- [ ] IRM "Was this useful?" check-in
- [ ] Bulk list of under-documented rules

---

## Risks

| Risk | Mitigation |
| --- | --- |
| Assistant latency | Show skeleton UI; cache similar-alert lookups |
| Poor generated text | Always show editable preview before save |
| Scope creep (IRM + bulk + export) | Timebox bonuses; ship must-have first |
| OSS vs Cloud Assistant differences | Stub tool locally; integrate GCX if available |

---

## Team contacts

| Name | Area |
| --- | --- |
| Lauren | Frontend validation |
| Pepe | Assistant tool |
