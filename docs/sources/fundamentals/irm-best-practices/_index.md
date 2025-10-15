---
description: Best practices for conducting effective investigations in Grafana
keywords:
  - grafana
  - investigation
  - troubleshooting
  - best practices
  - incident response
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Investigation best practices
weight: 350
---
# Investigation best practices
This guide helps you conduct effective investigations in Grafana. You'll learn how to create reusable content, define stakeholders, use severity levels, and build an investigation knowledge base that reduces resolution time.
## Before you begin
You should have:
- Access to Grafana with relevant dashboards and data sources configured
- Understanding of your system architecture and monitoring setup
- Team agreement on investigation processes
## What makes good investigation content
Good investigation content is structured, actionable, and reusable. It helps you and your team resolve issues faster over time.
### Content structure
Create investigation content with these sections:
**Investigation metadata**
- Unique identifier or incident number
- Start and end timestamps
- Severity level
- Investigation lead name
- Affected services or systems
**Impact summary**
- User or business impact description
- Affected user count or percentage
- Service degradation metrics
- Available workarounds
**Timeline**
- Detection time and method
- Key investigation milestones
- Actions taken with timestamps
- Resolution time
**Technical details**
- Observed symptoms with specific metrics
- Error messages or log entries
- Recent changes (deployments, configuration)
- Baseline metric comparisons
**Investigation log**
- Hypotheses tested with results
- Commands or queries run
- Data sources examined
- Findings that eliminated potential causes
**Resolution**
- Root cause description
- Fix applied with details
- Validation steps confirming resolution
### Content quality criteria
Your investigation content is high quality when it:
- **Is specific**: Includes actual metric values, error messages, and timestamps
- **Is complete**: Covers what happened, why it happened, and how you fixed it
- **Is searchable**: Uses consistent terminology and tags
- **Is linked**: References dashboards, runbooks, and related incidents
- **Is actionable**: Provides clear steps that others can follow
### Example investigation template
```markdown
# Investigation: High API Error Rate - 2025-10-15
**ID**: INC-2025-1015-001
**Severity**: 2 (High)
**Lead**: Jane Smith
**Duration**: 14:23 - 15:47 UTC (1h 24m)
## Impact
API error rate increased from 0.1% to 15.3% affecting approximately 10,000 users.
Users experienced failed checkout attempts. No workaround available.
## Timeline
- 14:23 - Alert fired: API error rate > 5%
- 14:28 - Investigation started
- 14:35 - Identified database connection pool exhaustion
- 14:45 - Increased pool size from 50 to 100
- 15:15 - Error rate returned to normal
- 15:47 - Incident closed after 30-minute observation period
## Technical details
**Symptoms**:
- Error rate: 15.3% (baseline: 0.1%)
- Database connection errors: `connection pool exhausted`
- Response time p95: 8.2s (baseline: 250ms)
**Recent changes**:
- Traffic increased 40% after marketing campaign launch at 14:00
**Investigation queries**:
```promql
rate(http_requests_total{status=~"5xx"}[5m])
database_connection_pool_active / database_connection_pool_max
```
## Root cause
Database connection pool size (50) was insufficient for increased traffic volume.
Connection pool exhaustion caused API requests to fail while waiting for available connections.
## Resolution
Increased database connection pool size to 100 and enabled connection pool monitoring alerts.
**Validation**:
- Error rate returned to 0.1%
- p95 response time returned to 280ms
- No connection pool exhaustion errors in logs
## Follow-up actions
- Review connection pool sizing for all services
- Create alert for connection pool utilization > 80%
- Update capacity planning documentation
## Severity levels
Severity levels help you prioritize investigations and allocate appropriate resources.
### Four-level severity framework
**Severity 1: Critical**
Use Severity 1 when:
- Complete service outage affects all users
- Critical security breach exposes sensitive data
- Data loss or corruption occurs
- Revenue impact exceeds $10,000 per hour
Response requirements:
- Immediate response (within 15 minutes)
- All-hands mobilization
- Executive notification
- Continuous updates every 15 minutes
**Severity 2: High**
Use Severity 2 when:
- Significant service degradation affects many users
- Partial outage impacts core functionality
- Security vulnerability is discovered
- Revenue impact is $1,000-$10,000 per hour
Response requirements:
- Response within 1 hour
- Dedicated investigation team
- Updates every 30 minutes
- Clear escalation path defined
**Severity 3: Medium**
Use Severity 3 when:
- Moderate service impact with workaround available
- Non-core functionality is affected
- Performance degradation is noticeable but manageable
- Limited user impact
Response requirements:
- Response within 4 hours during business hours
- Standard investigation team
- Updates every 2 hours
- Document findings for knowledge base
**Severity 4: Low**
Use Severity 4 when:
- Minor issues with minimal user impact
- Cosmetic problems
- Enhancement requests
- No immediate business impact
Response requirements:
- Response by next business day
- Individual investigator
- Updates at key milestones only
### Why severity levels matter
Severity levels provide these benefits:
**Clear expectations**: Everyone understands response urgency and update frequency.
**Resource optimization**: You don't over-allocate resources to minor issues or under-respond to critical problems.
**Communication consistency**: Stakeholders receive appropriate information at the right frequency.
**Escalation triggers**: You know when to involve additional teams or leadership.
**Metrics and improvement**: You can track response times and resolution effectiveness by severity.
### Adjust severity dynamically
Change severity levels as you learn more:
- **Escalate** when impact is worse than initially assessed
- **De-escalate** when you implement effective workarounds
- **Document** why you changed severity with timestamp and rationale
## Define stakeholders
Effective stakeholder management ensures the right people are involved with appropriate responsibilities.
### Stakeholder roles
**Investigation lead**
The investigation lead:
- Coordinates all investigation activities
- Maintains timeline and documentation
- Manages stakeholder communication
- Makes decisions on actions to take
- Ensures handoff when taking breaks
**Subject matter experts**
Subject matter experts (SMEs):
- Provide technical expertise for affected systems
- Execute remediation actions
- Validate proposed solutions
- Share knowledge with the team
**Service owners**
Service owners:
- Take responsibility for affected services
- Approve changes to their services
- Coordinate with dependent teams
- Participate in post-incident review
**Business stakeholders**
Business stakeholders:
- Define business impact and priority
- Approve trade-offs between speed and safety
- Communicate with customers when needed
- Provide business context for decisions
**Support teams**
Support teams:
- Provide infrastructure or platform expertise
- Assist with cross-cutting concerns (networking, security)
- Help with specialized tools or systems
### Select stakeholders by severity
| Severity | Core team | Extended team | Leadership |
|----------|-----------|---------------|------------|
| **Severity 1** | Lead + SMEs + Service owners | Business stakeholders + All support teams | VP/C-level notification |
| **Severity 2** | Lead + SMEs + Service owners | Business stakeholders + Key support teams | Director notification |
| **Severity 3** | Lead + SMEs | Service owners (optional) | Manager notification |
| **Severity 4** | Individual or small team | As needed | No notification |
### Communication guidelines
**Create dedicated channels**:
- Set up a Slack channel or incident room for Severity 1-2 investigations
- Use channel naming convention: `#incident-YYYYMMDD-brief-description`
- Pin key links (dashboards, runbooks, documentation) to the channel
**Set update frequency**:
- Severity 1: Every 15 minutes
- Severity 2: Every 30 minutes
- Severity 3: Every 2 hours or at milestones
- Severity 4: At key milestones only
**Use structured updates**:
```markdown
**Update [timestamp]**
What we know: [Current understanding]
What we don't know: [Outstanding questions]
What we're doing: [Current actions]
Next update: [Expected time]
```
**Document decisions**:
- Record why you chose specific investigation paths
- Explain why you ruled out certain hypotheses
- Note trade-offs made during resolution
## Build reusable investigation content
Create content that makes future investigations faster and more effective.
### Investigation templates
Create templates for common investigation types:
**Performance degradation template**
```markdown
# Performance Investigation Template
## Quick checks
- [ ] Compare current metrics to baseline (last 24h, 7d, 30d)
- [ ] Check recent deployments or configuration changes
- [ ] Review error logs for new patterns
- [ ] Verify external dependency status
## Key metrics to examine
- Response time percentiles (p50, p95, p99)
- Request volume and rate
- Error rate by endpoint
- Resource utilization (CPU, memory, disk I/O)
- Database query performance
- Cache hit rates
## Common causes to investigate
1. Resource exhaustion (memory, CPU, connections)
2. Database performance (slow queries, lock contention)
3. External dependency issues
4. Code changes introducing inefficiencies
5. Traffic pattern changes
6. Cache invalidation or warming issues
```
**Service outage template**
```markdown
# Service Outage Investigation Template
## Immediate actions
- [ ] Assess blast radius (affected services, users, regions)
- [ ] Check service health (load balancers, instances, containers)
- [ ] Review recent changes (last 4 hours)
- [ ] Verify infrastructure status
## Investigation checklist
- [ ] Load balancer health checks passing
- [ ] Application instances running and healthy
- [ ] Database connectivity and performance
- [ ] Network connectivity between services
- [ ] DNS resolution working correctly
- [ ] SSL certificates valid
- [ ] Disk space available
- [ ] Required external services accessible
## Rollback decision criteria
Consider rollback if:
- Issue started after recent deployment
- No progress after 30 minutes of investigation
- Impact is Severity 1 and cause is unclear
```
### Runbook library
Create runbooks for repeatable procedures:
**Structure your runbooks with**:
- Clear title describing the procedure
- When to use this runbook
- Prerequisites and required access
- Step-by-step instructions with exact commands
- Expected output or results
- Validation steps
- Rollback procedures if applicable
**Example runbook structure**:
```markdown
# Runbook: Scale API Service
## When to use
Use this runbook when API response times exceed 2 seconds and CPU > 80%.
## Prerequisites
- kubectl access to production cluster
- Approval from on-call engineering lead for Severity 1-2
## Procedure
1. Check current replica count:
   ```sh
   kubectl get deployment api-service -n production
   ```
2. Review current resource utilization:
   ```sh
   kubectl top pods -n production -l app=api-service
   ```
3. Scale deployment:
   ```sh
   kubectl scale deployment api-service -n production --replicas=<NEW_COUNT>
   ```
4. Verify pods are running:
   ```sh
   kubectl get pods -n production -l app=api-service -w
   ```
5. Monitor metrics for 5 minutes:
   - Dashboard: https://grafana.example.com/d/api-health
   - Check: Response times returning to < 500ms
   - Check: CPU utilization < 70%
## Validation
- All new pods show "Running" status
- Health checks passing
- Error rate remains stable or decreases
## Rollback
If issues occur, scale back to original replica count immediately.
### Query library
Save effective Grafana queries for reuse:
**Organize queries by category**:
- Error rate analysis
- Performance metrics
- Resource utilization
- Security events
- User impact assessment
**Document each query with**:
- Query description and purpose
- When to use the query
- How to interpret results
- Related queries or follow-up investigations
**Example query documentation**:
```markdown
## Query: API Error Rate by Endpoint
**Purpose**: Identify which API endpoints are experiencing errors.
**When to use**: During error rate investigations to narrow down affected endpoints.
**Query**:
```promql
sum by (endpoint) (rate(http_requests_total{status=~"5xx"}[5m]))
/
sum by (endpoint) (rate(http_requests_total[5m]))
```
**Interpretation**:
- Values > 0.05 (5%) indicate significant error rates
- Compare to baseline for each endpoint
- Check if errors are isolated to specific endpoints or widespread
**Follow-up queries**:
- Error details: `{endpoint="<ENDPOINT>"} |= "error"`
- Response times: `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{endpoint="<ENDPOINT>"}[5m]))`
### Dashboard library
Create investigation-specific dashboards:
**Investigation dashboard types**:
- Service health overview dashboards
- Error analysis dashboards
- Performance deep-dive dashboards
- Resource utilization dashboards
- Dependency status dashboards
**Dashboard best practices**:
- Use consistent naming: `Investigation: <Service> <Purpose>`
- Include time comparison panels (current vs. baseline)
- Add annotation overlays for deployments and incidents
- Link to related dashboards and runbooks
- Include query explanations in panel descriptions
### Knowledge base structure
Organize your investigation content systematically:
```
investigation-knowledge/
├── templates/
│   ├── performance-degradation.md
│   ├── service-outage.md
│   └── security-incident.md
├── runbooks/
│   ├── scale-service.md
│   ├── restart-database.md
│   └── rollback-deployment.md
├── queries/
│   ├── error-analysis.md
│   ├── performance-metrics.md
│   └── resource-utilization.md
├── incidents/
│   ├── 2025/
│   │   ├── 10/
│   │   │   ├── inc-2025-1015-001.md
│   │   │   └── inc-2025-1015-002.md
└── postmortems/
    ├── 2025-q4-database-outage.md
    └── 2025-q3-api-performance.md
```
## Archive and learn from investigations
Transform investigation data into institutional knowledge.
### Post-investigation documentation
After resolving an investigation, create:
**Incident summary**: Brief description for searchability and quick reference.
**Timeline**: Key events from detection to resolution.
**Root cause analysis**: What happened and why it happened.
**Resolution steps**: What you did to fix the issue.
**Lessons learned**: What worked well and what to improve.
**Action items**: Specific follow-up tasks with owners.
### Extract reusable patterns
Review completed investigations to identify:
- Common symptoms for similar issues
- Effective diagnostic approaches
- Useful queries or commands
- Gaps in monitoring or alerting
- Process improvements needed
### Update existing content
After each investigation:
- Add new queries to your query library
- Update runbooks with lessons learned
- Create new runbooks for repeated procedures
- Enhance dashboards with useful visualizations
- Update templates with better structure
### Tag and categorize
Make content searchable by tagging:
- Service or system affected
- Type of issue (performance, outage, security)
- Root cause category
- Resolution method
- Severity level
### Share knowledge
Distribute investigation learnings:
- Present interesting cases in team meetings
- Write blog posts for company-wide visibility
- Update documentation and training materials
- Conduct post-incident reviews with stakeholders
- Mentor team members during investigations
## Measure improvement
Track metrics to validate your investigation practices:
**Time metrics**:
- Mean Time to Detection (MTTD)
- Mean Time to Resolution (MTTR)
- Time from detection to investigation start
- Time spent on repeat issues
**Quality metrics**:
- Investigation documentation completeness
- Runbook usage frequency
- Number of repeat incidents
- Stakeholder satisfaction scores
**Knowledge metrics**:
- Time saved using existing runbooks
- Query library size and usage
- Template usage in new investigations
- Training effectiveness for new team members
## Related content
- [Troubleshooting](../../troubleshooting/)
- [Grafana Alerting best practices](../../alerting/best-practices/)
- [Panel inspector](../../panels-visualizations/panel-inspector/)
- [Query and transform data](../../panels-visualizations/query-transform-data/)

