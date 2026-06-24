# User flows — The Mystery Alert

## Flow 1 — Create alert rule (prevent)

**Actor:** Alert rule author  
**Goal:** Save a rule with actionable summary and description

```mermaid
sequenceDiagram
  actor Author
  participant Form as Alert rule form
  participant Validator
  participant Assistant
  participant API as Alerting API

  Author->>Form: Configure query, labels, conditions
  Author->>Form: Click Save
  Form->>Validator: Check summary & description

  alt Fields missing (must have)
    Validator-->>Author: Block save, show field errors
    Author->>Form: Fill in summary & description
    Author->>Form: Click Save
  else Fields missing (bonus: auto-generate)
    Validator->>Assistant: Generate from query + labels
    Assistant-->>Form: Proposed summary & description
    Author->>Form: Review, edit, confirm
  end

  Form->>API: Save rule with annotations
  API-->>Author: Rule saved
```

### Steps

1. Author opens **Alerting → Alert rules → New alert rule**
2. Configures query, labels, and evaluation settings
3. Fills **Summary** and **Description** (new required fields)
4. Clicks **Save**
5. If validation fails, inline errors appear on empty fields
6. (Bonus) If empty on save, Assistant proposes values in a review step

---

## Flow 2 — Firing alert with no context (explain)

**Actor:** On-call engineer  
**Goal:** Understand what the alert means and decide what to do

```mermaid
sequenceDiagram
  actor Oncall as On-call engineer
  participant Alert as Alert instance view
  participant Explain as Explain drawer
  participant Assistant
  participant Rule as Alert rule

  Oncall->>Alert: Open firing alert instance
  Alert-->>Oncall: Vague name, query visible, no summary/description
  Oncall->>Alert: Click Explain
  Alert->>Assistant: query, labels, annotations, history
  Assistant-->>Explain: summary, description, analysis
  Explain-->>Oncall: Show context + recurring/similar alert signals

  alt User wants to fix the rule
    Oncall->>Explain: Add this context to the alert?
    Explain->>Rule: Update annotations.summary & annotations.description
    Rule-->>Oncall: Rule updated
  else User only needs triage info
    Oncall->>Explain: Close drawer, proceed with incident
  end
```

### Steps

1. Engineer receives page or opens **Alerting → Alerts**
2. Selects firing instance with poor context
3. Clicks **Explain**
4. Drawer shows:
   - Generated summary and description
   - Query interpretation
   - (Stretch) Similar alerts with good annotations
   - (Stretch) Notification / silence history
5. Engineer triages the incident
6. Optionally clicks **Add this context to the alert** to persist improvements

---

## Flow 3 — Impact evaluation (useless vs under-documented)

**Actor:** On-call engineer  
**Goal:** Decide if the alert should be fixed, silenced, or deleted

```mermaid
flowchart TD
  Start[Open firing alert] --> CheckHistory{Alert recurring?}

  CheckHistory -->|No| ExplainPath[Explain from query]
  ExplainPath --> Similar[Check similar alerts]
  Similar --> PullContext[Pull descriptions from similar rules or notification history]
  PullContext --> Drawer[Show Explain drawer]

  CheckHistory -->|Yes| HistoryPath[Check notification + IRM history]
  HistoryPath --> Pattern{Repeated silences or no action?}
  Pattern -->|Yes| FlagUseless[Flag as likely useless]
  Pattern -->|No| ExplainPath
  FlagUseless --> Recommend[Recommend: tune threshold, add description, or remove rule]
```

### Decision guide (for UI copy)

| Signal | Likely diagnosis | Suggested action |
| --- | --- | --- |
| First time firing, empty annotations | Under-documented | Explain → add context |
| Fires often, frequently silenced | Noisy / useless | Review threshold or delete |
| Similar rules have good annotations | Copy-paste gap | Pull from similar alert |
| IRM incidents with "not useful" votes | Useless | Improve or remove in check-in flow |

---

## Flow 4 — IRM incident check-in (improve)

**Actor:** Incident responder  
**Goal:** Feed incident learnings back into alerting

```mermaid
sequenceDiagram
  actor Responder
  participant IRM as IRM incident
  participant Checkin as Usefulness check-in
  participant Assistant
  participant Rule as Alert rule

  Responder->>IRM: Resolve incident
  IRM->>Checkin: Was this alert useful?
  Responder->>Checkin: No

  Checkin->>Assistant: Incident context + alert rule + timeline
  Assistant-->>Checkin: Suggested summary, description, rule changes
  Checkin-->>Responder: Review suggestions

  alt Accept improvements
    Responder->>Rule: Apply suggested annotations
    Rule-->>Responder: Alert rule updated
  else Dismiss
    Checkin-->>Responder: Done
  end
```

### Steps

1. Responder resolves incident in IRM
2. Prompt: **Was the alert that triggered this incident useful?**
3. **Yes** → flow ends
4. **No** → Assistant consolidates incident notes, timeline, and alert metadata
5. Suggests improved summary, description, or rule configuration
6. Responder accepts or dismisses

---

## Flow 5 — Bulk identify under-documented rules

**Actor:** Platform / alerting admin  
**Goal:** Find and fix rules missing context at scale

1. Open **Alerting → Alert rules**
2. Apply filter: **Missing summary or description** (or below length threshold)
3. Review list of affected rules
4. (Bonus) Select multiple rules → **Generate context** via Assistant
5. Review and save batch updates
6. (Bonus) Export updated rules for provisioning

---

## UI touchpoints

| Surface | Change |
| --- | --- |
| Alert rule form (create/edit) | Required Summary & Description fields; save validation |
| Alert instance detail | Explain button; context drawer |
| Alert rules list | Filter for missing/short annotations; bulk actions |
| Notification template (bonus) | Include Explain-generated context |
| IRM incident resolution (bonus) | Usefulness check-in; link back to alert rule |
