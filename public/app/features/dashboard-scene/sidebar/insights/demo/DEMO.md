# Dashboard Insights: 5-minute demo

Four parts: what we built, how it helps, why we built it, and how it can be extended. The **Say** lines fit their time slots at a normal speaking pace; times are from the start of the talk. Keep it light, and drop any joke that doesn't suit the room.

Answers take a while, so most of the screen is prepared beforehand and only one question is asked live.

## The demo dashboard

**Grafana Assistant / Service health** (UID `assistant-service-health`) shows the Grafana Assistant backend across the dev clusters: API traffic, LLM usage and cost, background workers, and infrastructure. It is in [assistant-service-health.json](assistant-service-health.json), a v2 dashboard resource that includes the saved questions.

Every panel queries a Prometheus data source with exactly the UID `grafanacloud-dev-prom`: URL `https://prometheus-dev-01-dev-us-central-0.grafana-dev.net/api/prom`, basic auth with the instance ID and an access policy token with `metrics:read`.

Import it from the `grafana` folder:

```bash
DASHBOARDS=http://localhost:3000/apis/dashboard.grafana.app/v2/namespaces/default/dashboards
DEMO=public/app/features/dashboard-scene/sidebar/insights/demo/assistant-service-health.json

# Replace an existing copy, if there is one
curl -s -u admin:admin -X DELETE "$DASHBOARDS/assistant-service-health"

curl -s -u admin:admin -H 'Content-Type: application/json' -X POST "$DASHBOARDS" -d @"$DEMO"
```

## Prepare, at least 10 minutes before each round

1. Run the Assistant with OSS mode off ([SETUP.md](SETUP.md)) and confirm `curl http://localhost:9091/ready` succeeds.
2. Open `http://localhost:3000/d/assistant-service-health` as `admin`, in the dark theme, on **Last 24 hours** and **Cluster** = **All**.
3. On the **Overview** tab, click **Ask Assistant** on the Insight panel at the top.
4. When the answer arrives, click **Share with viewers**, then **Investigate**.
5. Leave this tab open on the Overview tab, with the sidebar closed. The investigation lives only in this page: a reload keeps the shared answer but loses the investigation.

## Two rounds

- **Jury:** use the jury closing line. Keep [SPEC.md](../SPEC.md) open for questions about how it works.
- **Company vote:** use the vote closing line. Record a screen capture of a good run, such as the jury round, and keep it ready in case the live demo misbehaves in front of everyone.

## Talk track

### 0:00 What we built (1 min)

**Show:** The answer on the Overview Insight panel: the question, the headline, the findings with their evidence, and what changed since the previous period.

**Say:** "Who here has opened a dashboard at 3 a.m., seen forty panels, and thought: which one of you is the problem? We built Dashboard Insights, so you can just ask. The author writes a question and picks the panels that answer it, as an Insight panel like this one, or in the Insights pane. You click **Ask Assistant** and get a headline, up to three findings, each pointing at its panel and time window, and what changed since the day before. The Assistant only sees those panels: no tools, no chat history, no wandering off. And yes, this is the Assistant's own dashboard. We asked the Assistant how the Assistant is doing. It was refreshingly honest."

### 1:00 How it helps (2 min)

1. **Do:** Click **Insights** (sparkle icon) in the sidebar, then **Ask Assistant** on "Which clusters are the least stable?"

   **Say:** "Every question on the dashboard lives in one place. I'll ask this one live, which is the bravest thing you'll see today. It's broken down by cluster, so every cluster gets its own report card."

2. **Do:** While it runs, point at the **Investigation** box under the Overview answer.

   **Say:** "When the answer is 'it's complicated', **Investigate** calls in the detective: an Assistant investigation that queries the data sources itself, and reports back here with what it found, the likely cause, and what to do next."

3. **Do:** Click the panel link under a finding in the Overview answer. It switches to the panel's tab.

   **Say:** "And you don't have to take its word for it. Every finding shows its work, which is more than I did in math class: a link to its panel, and to Explore over the exact time window."

4. **Do:** Back in the pane, show the live answer and its **By cluster** section.

   **Say:** "And there's the live answer, one takeaway per cluster. That's the first read of a dashboard in seconds. And an editor can share a good answer, like the one at the top, so nobody has to ask, or pay for the tokens, twice."

### 3:00 Why we built it (1 min)

**Say:** "Dashboards are great at showing everything. Unfortunately, everything is a lot. Reading one takes someone who knows the system, and that person is on vacation when the incident starts. The Assistant can help, but in chat you start from a blank prompt, and it has to guess which panels matter. The author already knows. So we let authors leave that knowledge on the dashboard as questions, like a note on the fridge. And we kept the answers honest: only the panels' data, evidence for every finding, and a caveat when the data can't answer. Nothing runs on its own, so the only thing burning tokens is your curiosity."

### 4:00 How it can be extended (1 min)

**Say:** "It's a prototype behind a feature flag, and the next steps write themselves:

- Slack: post an answer to a channel, and later on a schedule. Because if it's not in Slack, did it even happen?
- Reports: run the question when a scheduled report renders, so the Monday PDF comes with a summary people actually read.
- Harder questions: a bigger model for the tricky ones, and panels from other dashboards as sources.
- Learning from use: every answer already has thumbs up and down. So far, we're the only ones clicking them."

**Close, jury round:** "Questions on the dashboard, answers you can check, and a detective on call. Thank you!"

**Close, company round:** "So next time a dashboard yells at you at 3 a.m., it can also tell you why. Vote for Dashboard Insights. Thank you!"

## If something goes wrong

| What you see                                       | What to do                                                                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| The live answer is still running at 3:00           | "It's still thinking. We'll check back, like a cake in the oven." Move on, and show the answer when it arrives.                |
| The live answer fails                              | "And that's our error handling. We built that too." Skip step 4 of "How it helps"; the Overview answer already shows the idea. |
| The investigation is still running                 | "Detectives take their time." Click **Open investigation** to show it working.                                                 |
| The page reloaded                                  | The shared Overview answer is still there. Describe the investigation instead of showing it.                                   |
| "… has no data for this selection" on the live ask | Go back to **Last 24 hours** and **Cluster** = **All**, and ask again once. If it repeats, treat it like a failed answer.      |

## Reset after the demo

Shared answers are organization annotations tagged `grafana-insight-answer`. To remove them:

```bash
curl -s -u admin:admin 'http://localhost:3000/api/annotations?tags=grafana-insight-answer&type=annotation&limit=200' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const a of JSON.parse(s)) console.log(a.id)})' \
  | xargs -I{} curl -s -u admin:admin -X DELETE http://localhost:3000/api/annotations/{}
```

Investigations stay in the Assistant.
