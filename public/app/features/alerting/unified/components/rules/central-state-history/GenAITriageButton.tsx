import { css } from '@emotion/css';
import { useCallback, useState } from 'react';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { llm } from '@grafana/llm';
import { Button, Modal, Stack, Text, TextArea, useStyles2 } from '@grafana/ui';

import { LogRecord } from '../state-history/common';

// Interface for tool arguments
interface GetEventDataArgs {
  includeDetails?: boolean;
}

// Interface for event data structure
interface ProcessedEvent {
  timestamp: string;
  alertRule: string;
  previousState: string;
  currentState: string;
  labels: Record<string, string>;
  ruleUID?: string;
  fingerprint?: string;
}

// Tool definition for getting event data for analysis
const GET_EVENT_DATA_TOOL = {
  type: 'function' as const,
  function: {
    name: 'get_event_data',
    description:
      'Retrieves current alert event data visible on the page for analysis. This includes state transitions, alert rules, timestamps, and labels to help understand patterns and issues.',
    parameters: {
      type: 'object',
      properties: {
        includeDetails: {
          type: 'boolean',
          description: 'Whether to include detailed event information',
          default: true,
        },
      },
      required: [],
    },
  },
};

const SYSTEM_PROMPT_CONTENT = `You are an expert in alert triage and incident analysis. Your role is to analyze alert event data and provide actionable insights to help operators understand what's happening and prioritize their response.

You have access to tools that can help you:
- get_event_data: Use this to retrieve the current alert events visible on the page for analysis

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

interface TriageAnalysisProps {
  analysis: string;
  styles: ReturnType<typeof getStyles>;
}

const TriageAnalysis = ({ analysis, styles }: TriageAnalysisProps) => {
  return (
    <div className={styles.analysis}>
      <h4>
        <Trans i18nKey="alerting.triage-ai.modal.analysis-title">Alert Triage Analysis</Trans>
      </h4>
      <div className={styles.analysisContent}>
        <Text variant="body">
          {analysis.split('\n').map((line, index) => (
            <div key={index} className={styles.analysisLine}>
              {line}
            </div>
          ))}
        </Text>
      </div>
    </div>
  );
};

export interface GenAITriageButtonProps {
  className?: string;
  logRecords: LogRecord[];
  timeRange: TimeRange;
}

export const GenAITriageButton = ({ className, logRecords, timeRange }: GenAITriageButtonProps) => {
  const styles = useStyles2(getStyles);

  const [showModal, setShowModal] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customQuestion, setCustomQuestion] = useState('');
  const logRecordsLength = logRecords.length;

  // Tool handler for getting event data
  const handleGetEventData = useCallback(
    async (args: unknown) => {
      try {
        // Type guard function to check if args is valid
        const isValidArgs = (args: unknown): args is GetEventDataArgs => {
          return (
            args === null ||
            args === undefined ||
            (typeof args === 'object' &&
              args !== null &&
              ('includeDetails' in args ? typeof args.includeDetails === 'boolean' : true))
          );
        };

        if (!isValidArgs(args)) {
          throw new Error('Invalid arguments provided to get_event_data tool');
        }

        const { includeDetails = true } = args || {};

        // Process the log records into analysis-friendly format
        const events: ProcessedEvent[] = logRecords.slice(0, 100).map((record) => ({
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

        const result = {
          success: true,
          summary: {
            totalEvents,
            alertingEvents,
            errorEvents,
            noDataEvents,
            normalEvents,
            uniqueAlertRules,
            timeSpan,
          },
          events: includeDetails ? events : events.slice(0, 20), // Limit events to avoid token limits
          eventsByRule: Object.entries(eventsByRule).map(([rule, ruleEvents]) => ({
            alertRule: rule,
            eventCount: ruleEvents.length,
            states: ruleEvents.map((e) => e.currentState),
            lastEvent: ruleEvents[0]?.timestamp,
          })),
        };

        return result;
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
          events: [],
          summary: {},
        };
      }
    },
    [logRecords, timeRange]
  );

  // Sets up the AI's behavior and context
  const createSystemPrompt = (): llm.Message => ({
    role: 'system',
    content: SYSTEM_PROMPT_CONTENT,
  });

  // Contains the actual user request for analysis
  const createUserPrompt = (customQuestion?: string): llm.Message => ({
    role: 'user',
    content: customQuestion
      ? `Please analyze the current alert events and answer this specific question: "${customQuestion}"

Use the get_event_data tool to access the current alert events and provide targeted analysis based on my question.`
      : `Please analyze the current alert events and provide triage insights. I need to understand what's happening and prioritize my response. Focus on:

1. What alerts need immediate attention?
2. Are there any patterns or correlations I should be aware of?
3. What should I investigate first?
4. Any insights about potential root causes?

Please use the get_event_data tool to access the current alert events and provide actionable analysis.`,
  });

  // Parse and handle the LLM response
  const handleParsedResponse = useCallback((reply: string) => {
    try {
      setAnalysis(reply);
    } catch (error) {
      console.error('Failed to process triage analysis:', error);
      setError('Failed to process the triage analysis. Please try again.');
    }
  }, []);

  // Handle LLM call with tools
  const handleAnalyzeWithTools = useCallback(
    async (messages: llm.Message[]) => {
      setIsAnalyzing(true);
      setError(null);

      try {
        // Check if LLM service is available
        const enabled = await llm.enabled();
        if (!enabled) {
          throw new Error('LLM service is not configured or enabled');
        }

        const response = await llm.chatCompletions({
          model: llm.Model.LARGE, // Use LARGE model for better analysis
          messages,
          tools: [GET_EVENT_DATA_TOOL],
          temperature: 0.1, // Lower temperature for more consistent analysis
        });

        const finalMessages = [...messages];

        // Handle tool calls if present
        if (response.choices[0]?.message?.tool_calls) {
          // Add the assistant's response with tool calls
          finalMessages.push({
            role: 'assistant',
            content: response.choices[0].message.content,
            tool_calls: response.choices[0].message.tool_calls,
          });

          // Process each tool call
          for (const toolCall of response.choices[0].message.tool_calls) {
            if (toolCall.function.name === 'get_event_data') {
              const args = JSON.parse(toolCall.function.arguments);
              const result = await handleGetEventData(args);

              // Add the tool result to the messages
              finalMessages.push({
                role: 'tool',
                content: JSON.stringify(result),
                tool_call_id: toolCall.id,
              });
            }
          }

          // Call LLM again with the tool results to generate final analysis
          const finalResponse = await llm.chatCompletions({
            model: llm.Model.LARGE,
            messages: finalMessages,
            tools: [GET_EVENT_DATA_TOOL],
            temperature: 0.1,
          });

          // Process the final response
          const finalContent = finalResponse.choices[0]?.message?.content;
          if (finalContent) {
            handleParsedResponse(finalContent);
          }
        } else {
          // No tool calls, process the response directly
          const content = response.choices[0]?.message?.content;
          if (content) {
            handleParsedResponse(content);
          }
        }
      } catch (error) {
        console.error('Failed to analyze alerts with LLM:', error);
        setError(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsAnalyzing(false);
      }
    },
    [handleGetEventData, handleParsedResponse]
  );

  const handleAnalyze = () => {
    if (logRecords.length === 0) {
      setError('No alert events available to analyze');
      return;
    }

    const messages: llm.Message[] = [createSystemPrompt(), createUserPrompt(customQuestion.trim() || undefined)];
    handleAnalyzeWithTools(messages);
  };

  const handleClose = () => {
    setShowModal(false);
    setAnalysis(null);
    setError(null);
    setCustomQuestion('');
  };

  return (
    <>
      <Button
        variant="secondary"
        icon="ai"
        onClick={() => setShowModal(true)}
        className={className}
        data-testid="triage-ai-button"
        disabled={logRecords.length === 0}
      >
        <Trans i18nKey="alerting.triage-ai.button">Analyze with AI</Trans>
      </Button>

      <Modal
        title={t('alerting.triage-ai.modal.title', 'Alert Triage Analysis')}
        isOpen={showModal}
        onDismiss={handleClose}
        className={styles.modal}
      >
        <Stack direction="column" gap={3}>
          <Text variant="body">
            <Trans i18nKey="alerting.triage-ai.modal.description">
              AI analysis of current alert events to help understand patterns, prioritize response, and identify
              potential issues.
            </Trans>
          </Text>

          <Stack direction="column" gap={1}>
            <Text variant="h6">
              <Trans i18nKey="alerting.triage-ai.modal.custom-question.label">Ask a specific question (optional)</Trans>
            </Text>
            <TextArea
              placeholder={t(
                'alerting.triage-ai.modal.custom-question.placeholder',
                `e.g., "What's causing the database alerts ? " or "Are these alerts related to the recent deployment ? "`
              )}
              value={customQuestion}
              onChange={(e) => setCustomQuestion(e.currentTarget.value)}
              rows={3}
              disabled={isAnalyzing}
            />
            <Text variant="bodySmall" color="secondary">
              <Trans i18nKey="alerting.triage-ai.modal.custom-question.help">
                Leave empty for general triage analysis, or ask a specific question about the alert events.
              </Trans>
            </Text>
          </Stack>

          {error && (
            <div className={styles.error}>
              <Trans i18nKey="alerting.triage-ai.modal.error">{error}</Trans>
            </div>
          )}

          {isAnalyzing && (
            <div className={styles.analyzing}>
              <Text variant="body">
                <Trans i18nKey="alerting.triage-ai.modal.analyzing" values={{ logRecordsLength }}>
                  🤖 Analyzing {{ logRecordsLength }} alert events...
                </Trans>
              </Text>
            </div>
          )}

          {analysis && <TriageAnalysis analysis={analysis} styles={styles} />}

          <Stack direction="row" justifyContent="flex-end" gap={2}>
            <Button variant="secondary" onClick={handleClose}>
              <Trans i18nKey="common.close">Close</Trans>
            </Button>
            {!analysis && !isAnalyzing && (
              <Button variant="primary" onClick={handleAnalyze} icon="ai">
                <Trans i18nKey="alerting.triage-ai.modal.analyze">Analyze</Trans>
              </Button>
            )}
          </Stack>
        </Stack>
      </Modal>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  modal: css({
    width: '80%',
    maxWidth: '900px',
    maxHeight: '80vh',
  }),
  error: css({
    color: theme.colors.error.text,
    backgroundColor: theme.colors.error.main,
    padding: theme.spacing(1),
    borderRadius: theme.shape.radius.default,
  }),
  analyzing: css({
    color: theme.colors.info.text,
    backgroundColor: theme.colors.info.main,
    padding: theme.spacing(2),
    borderRadius: theme.shape.radius.default,
    textAlign: 'center',
  }),
  analysis: css({
    backgroundColor: theme.colors.background.secondary,
    padding: theme.spacing(2),
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.medium}`,
    maxHeight: '60vh',
    overflowY: 'auto',
  }),
  analysisContent: css({
    marginTop: theme.spacing(1),
  }),
  analysisLine: css({
    marginBottom: theme.spacing(0.5),
    lineHeight: 1.5,
  }),
});
