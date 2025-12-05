# BabyBot Metrics Export

Export and analyze BabyBot usability review metrics from GitHub.

## Quick Start

```bash
# Export to both CSV and JSON
python .github/scripts/export-babybot-metrics.py

# Export only CSV
python .github/scripts/export-babybot-metrics.py --format csv --output my-metrics

# Export only JSON
python .github/scripts/export-babybot-metrics.py --format json
```

## Output Files

### CSV Format (`babybot-metrics.csv`)
Detailed row-per-comment data, suitable for Excel, Google Sheets, or data analysis tools.

| Column | Description |
|--------|-------------|
| comment_id | GitHub comment ID |
| pr_number | PR number |
| comment_type | `resolvable` or `general` |
| severity | Critical, Major, or Minor |
| confidence | Low, Medium, or High |
| file | File path (for resolvable comments) |
| created_at | Timestamp |
| url | Link to comment |
| total_reactions | Number of reactions (👍, ❤️, 🎉, etc.) |
| has_reply | Boolean - whether comment has replies |
| engagement_score | Calculated engagement score |

### JSON Format (`babybot-metrics.json`)
Aggregated metrics with summaries by PR, severity, and confidence.

```json
{
  "total_comments": 42,
  "resolvable_comments": 38,
  "general_comments": 4,
  "by_severity": {
    "Critical": 5,
    "Major": 20,
    "Minor": 17
  },
  "by_confidence": {
    "High": 10,
    "Medium": 25,
    "Low": 7
  },
  "engagement": {
    "comments_with_reactions": 15,
    "comments_with_replies": 8,
    "total_reactions": 45,
    "avg_reactions_per_comment": 1.07,
    "engagement_rate": 35.7
  },
  "by_pr": {
    "114646": {
      "count": 3,
      "severities": {"Major": 2, "Minor": 1},
      "engaged": 2
    }
  }
}
```

## Dashboard Integration Options

### 1. Google Sheets Dashboard
```bash
# Export CSV and upload to Google Sheets
python .github/scripts/export-babybot-metrics.py --format csv
# Upload babybot-metrics.csv to Google Sheets
# Create pivot tables and charts
```

### 2. Grafana Dashboard
```bash
# Export JSON and serve via HTTP
python .github/scripts/export-babybot-metrics.py --format json
# Use JSON API data source in Grafana
```

### 3. Automated Weekly Reports (GitHub Actions)
See `.github/workflows/babybot-weekly-report.yml` (create this workflow)

### 4. Tableau/Power BI
Import the CSV file directly into your BI tool.

## Metrics Tracked

- **Total comments posted** by BabyBot
- **Resolvable vs general comments** (indicates attachment success rate)
- **Issues by severity** (Critical/Major/Minor breakdown)
- **Issues by confidence** (High/Medium/Low)
- **PRs reviewed** (count and distribution)
- **Comments per PR** (average and trends)
- **Engagement metrics:**
  - Comments with reactions (👍, ❤️, 🎉, etc.)
  - Comments with replies (developer responses)
  - Total reactions count
  - Average reactions per comment
  - Engagement rate % (how many comments get any response)

## Tracking Comment Engagement (Proxy for "Resolved")

Since GitHub doesn't expose "resolved" status via API, we track **engagement** as a proxy:

### Reactions as Resolution Indicators

Establish a reaction convention with your team:
- ✅ 👍 (`:+1:`) = Acknowledged/Understood
- 🎉 (`:hooray:`) = Fixed/Resolved
- 👀 (`:eyes:`) = Looking into it
- ❤️ (`:heart:`) = Appreciated/Helpful

### Query Engagement

```bash
# Get all BabyBot comments with reactions
gh api repos/grafana/grafana/pulls/comments --paginate \
  --jq '.[] | select(.body | contains("BabyBot 🍼")) | {id: .id, reactions: .reactions, pr: .pull_request_url}'

# Count comments with specific reactions (e.g., "resolved" markers)
gh api repos/grafana/grafana/pulls/comments --paginate \
  --jq '[.[] | select(.body | contains("BabyBot 🍼")) | .reactions.hooray] | add'
```

### Export shows:
- `total_reactions`: All reactions on the comment
- `has_reply`: Whether developers responded with a comment
- `engagement_score`: Weighted score (reactions + reply bonus)

High engagement score = comment was noticed and actioned! 📊

## Scheduling Automatic Exports

Add to `.github/workflows/babybot-weekly-report.yml`:

```yaml
name: BabyBot Weekly Metrics
on:
  schedule:
    - cron: '0 9 * * MON'  # Every Monday at 9am
  workflow_dispatch:  # Manual trigger

jobs:
  export-metrics:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Export metrics
        run: python .github/scripts/export-babybot-metrics.py

      - name: Upload to artifact
        uses: actions/upload-artifact@v4
        with:
          name: babybot-metrics-${{ github.run_number }}
          path: babybot-metrics.*

      - name: Post to Slack
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
        run: |
          # Parse JSON and send summary to Slack
          SUMMARY=$(cat babybot-metrics.json | jq -r '"Total Comments: \(.total_comments), Critical: \(.by_severity.Critical // 0), Major: \(.by_severity.Major // 0)"')
          curl -X POST $SLACK_WEBHOOK_URL \
            -H 'Content-type: application/json' \
            -d "{\"text\": \"📊 Weekly BabyBot Metrics: $SUMMARY\"}"
```

## Example Queries

```bash
# Count by PR
jq '.by_pr | to_entries | map({pr: .key, count: .value.count})' babybot-metrics.json

# Average comments per PR
jq '[.by_pr[].count] | add / length' babybot-metrics.json

# Critical issues percentage
jq '(.by_severity.Critical / .total_comments * 100)' babybot-metrics.json
```
