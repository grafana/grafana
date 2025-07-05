import { TimeRange } from '@grafana/data';
import { llm } from '@grafana/llm';

import { LogRecord } from '../../state-history/common';

export const SYSTEM_PROMPT_CONTENT = `You are an expert in alert triage and incident analysis. Your role is to analyze alert event data and provide actionable insights to help operators understand what's happening and prioritize their response.

When analyzing alert events, focus on:

**Pattern Recognition:**
- Identify recurring alerts or patterns
- Spot correlated failures across services
- Detect unusual state transition patterns
- Notice timing correlations

**Severity Assessment:**
- Highlight critical/alerting states that need immediate attention
- Identify which alerts are most important to investigate first
- Flag any alerts in error states or with unusual behavior

**Trend Analysis:**
- Analyze if alerts are increasing, decreasing, or stable
- Identify if issues are spreading across systems
- Notice recovery patterns or persistent problems

**Actionable Recommendations:**
- Suggest which alerts to investigate first (triage priority)
- Recommend potential root causes to investigate
- Identify related alerts that might have the same underlying issue
- Suggest if this looks like a known pattern (service restart, deployment issue, infrastructure problem, etc.)

**Summary Format:**
Provide your analysis in this structure:
1. **🚨 Immediate Attention** - Critical alerts needing urgent action
2. **📊 Pattern Analysis** - Key patterns and trends identified
3. **🔍 Investigation Priority** - Recommended order of investigation
4. **💡 Insights** - Potential root causes and correlations
5. **⏭️ Next Steps** - Suggested actions for operators

Keep your analysis concise but comprehensive. Focus on actionable insights that help operators quickly understand the situation and respond effectively.`;

/**
 * Sets up the AI's behavior and context
 * @returns The system prompt as a llm.Message
 */
export const createSystemPrompt = (): llm.Message => ({
  role: 'system',
  content: SYSTEM_PROMPT_CONTENT,
});

interface EventData {
  summary: {
    totalEvents: number;
    alertingEvents: number;
    errorEvents: number;
    noDataEvents: number;
    normalEvents: number;
    uniqueAlertRules: number;
    timeSpan: {
      from: string;
      to: string;
    };
  };
  events: ProcessedEvent[];
  eventsByRule: Array<{
    alertRule: string;
    eventCount: number;
    states: string[];
    lastEvent: string;
  }>;
}

interface ProcessedEvent {
  timestamp: string;
  alertRule: string;
  previousState: string;
  currentState: string;
  labels: Record<string, string>;
  ruleUID?: string;
  fingerprint?: string;
}

/**
 * Process log records into analysis-friendly format
 * @param logRecords - The log records to process
 * @param timeRange - The time range to use for the analysis
 * @returns The processed event data
 */
export const processEventData = (logRecords: LogRecord[], timeRange: TimeRange): EventData => {
  // Process only the first 50 log records to avoid unnecessary processing and token limits
  const events: ProcessedEvent[] = logRecords.slice(0, 50).map((record) => ({
    timestamp: new Date(record.timestamp).toISOString(),
    alertRule: record.line.labels?.alertname || 'Unknown',
    previousState: record.line.previous,
    currentState: record.line.current,
    labels: record.line.labels || {},
    ruleUID: record.line.ruleUID,
    fingerprint: record.line.fingerprint,
  }));

  // Calculate summary statistics
  const totalEvents = events.length;
  const alertingEvents = events.filter((e) => e.currentState === 'Alerting').length;
  const errorEvents = events.filter((e) => e.currentState === 'Error').length;
  const noDataEvents = events.filter((e) => e.currentState === 'NoData').length;
  const normalEvents = events.filter((e) => e.currentState === 'Normal').length;

  const uniqueAlertRules = new Set(events.map((e) => e.alertRule)).size;
  const timeSpan = {
    from: timeRange.from.toISOString(),
    to: timeRange.to.toISOString(),
  };

  // Group events by alert rule to identify patterns
  const eventsByRule = events.reduce((acc: Record<string, ProcessedEvent[]>, event) => {
    const rule = event.alertRule;
    if (!acc[rule]) {
      acc[rule] = [];
    }
    acc[rule].push(event);
    return acc;
  }, {});

  return {
    summary: {
      totalEvents,
      alertingEvents,
      errorEvents,
      noDataEvents,
      normalEvents,
      uniqueAlertRules,
      timeSpan,
    },
    events, // Use all processed events (already limited to 50)
    eventsByRule: Object.entries(eventsByRule).map(([rule, ruleEvents]) => ({
      alertRule: rule,
      eventCount: ruleEvents.length,
      states: ruleEvents.map((e) => e.currentState),
      lastEvent: ruleEvents[0]?.timestamp,
    })),
  };
};

/**
 * Contains the actual user request for analysis with event data
 * @param customQuestion - The custom question to answer
 * @returns The user prompt as a llm.Message
 */
export const createUserPrompt = (
  logRecords: LogRecord[],
  timeRange: TimeRange,
  customQuestion?: string
): llm.Message => {
  const eventData = processEventData(logRecords, timeRange);

  const basePrompt = customQuestion
    ? `Please analyze the alert events below and answer this specific question: "${customQuestion}"`
    : `Please analyze the alert events below and provide triage insights. I need to understand what's happening and prioritize my response. Focus on:

1. What alerts need immediate attention?
2. Are there any patterns or correlations I should be aware of?
3. What should I investigate first?
4. Any insights about potential root causes?`;

  const eventDataText = `

## Alert Event Data

### Summary
- **Total Events**: ${eventData.summary.totalEvents}
- **Alerting Events**: ${eventData.summary.alertingEvents}
- **Error Events**: ${eventData.summary.errorEvents}
- **NoData Events**: ${eventData.summary.noDataEvents}
- **Normal Events**: ${eventData.summary.normalEvents}
- **Unique Alert Rules**: ${eventData.summary.uniqueAlertRules}
- **Time Range**: ${eventData.summary.timeSpan.from} to ${eventData.summary.timeSpan.to}

### Events by Alert Rule
${eventData.eventsByRule
  .map(
    (rule) =>
      `**${rule.alertRule}**: ${rule.eventCount} events, States: [${rule.states.join(', ')}], Last Event: ${rule.lastEvent}`
  )
  .join('\n')}

### Recent Events (up to 50)
${eventData.events
  .map(
    (event) =>
      `- **${event.timestamp}** | ${event.alertRule} | ${event.previousState} → ${event.currentState} | Labels: ${JSON.stringify(event.labels)}`
  )
  .join('\n')}

---

Please provide actionable analysis based on this data.`;

  return {
    role: 'user',
    content: basePrompt + eventDataText,
  };
};
