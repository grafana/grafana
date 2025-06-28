import { css } from '@emotion/css';
import { useCallback, useState } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { GrafanaTheme2, urlUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { llm } from '@grafana/llm';
import { locationService } from '@grafana/runtime';
import { Button, Field, Modal, Stack, TextArea, useStyles2 } from '@grafana/ui';

import { useListContactPointsv0alpha1 } from '../../../../../../../packages/grafana-alerting/src/grafana/contactPoints/hooks/useContactPoints';
import { DEFAULT_LLM_MODEL, Message, sanitizeReply } from '../../../../dashboard/components/GenAI/utils';
import { LogMessages, logInfo } from '../../Analytics';
import { getDefaultFormValues } from '../../rule-editor/formDefaults';
import { RuleFormType, RuleFormValues } from '../../types/rule-form';

// Tool definition for getting contact points
const GET_CONTACT_POINTS_TOOL = {
  type: 'function' as const,
  function: {
    name: 'get_contact_points',
    description:
      'Retrieves a list of all contact points (notification receivers) configured in Grafana Alerting. Contact points define how and where alert notifications are sent.',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Optional limit for the number of contact points to return',
          minimum: 1,
          maximum: 1000,
        },
      },
      required: [],
    },
  },
};

const SYSTEM_PROMPT_CONTENT = `You are an expert in creating Grafana alert rules. Based on the user's description, generate a properly structured alert rule configuration.

You have access to tools that can help you:
- get_contact_points: Use this to retrieve available contact points when the user asks about notifications or wants to see what contact points are available

Return a JSON object that matches the RuleFormValues interface with these key fields:
- name: A descriptive name for the alert rule
- type: Always use "grafana-alerting"
- queries: An array of alert queries with proper datasource configuration
- condition: The refId of the query condition (usually "C")
- evaluateFor: How long the condition must be true (e.g., "5m")
- noDataState: What to do when no data (usually "NoData")
- execErrState: What to do on execution error (usually "Alerting")
- annotations: Array of key-value pairs for additional information
- labels: Array of key-value pairs for categorization
- folder: Object with title and uid for organization (find the folder in the user's organization, if it doesn't exist, create it)
- group: The group name for the alert rule (find a group inside the folder, if it doesn't exist, create it)
- contactPoints: Use actual contact point names from the get_contact_points tool when available. Include all required routing settings:
  - selectedContactPoint: The contact point name
  - overrideGrouping: false (unless specifically requested)
  - groupBy: [] (empty array unless custom grouping requested)
  - overrideTimings: false (unless custom timing requested)
  - groupWaitValue: "" (empty unless overrideTimings is true)
  - groupIntervalValue: "" (empty unless overrideTimings is true)
  - repeatIntervalValue: "" (empty unless overrideTimings is true)
  - muteTimeIntervals: [] (array of mute timing names)
  - activeTimeIntervals: [] (array of active timing names)

For queries, include:
- A data query (refId: "A") from appropriate datasource
- A condition query (refId: "C") that evaluates the data

When the user mentions notifications or asks about contact points, always use the get_contact_points tool first to see what's available.

Example structure:
{
  "name": "High CPU Usage Alert",
  "type": "grafana-alerting",
  "queries": [
    {
      "refId": "A",
      "model": {"expr": "cpu_usage", "refId": "A"},
      "datasourceUid": "prometheus-uid",
      "queryType": "",
      "relativeTimeRange": {"from": 600, "to": 0}
    },
    {
      "refId": "C",
      "model": {"expression": "A > 80", "type": "threshold", "refId": "C"},
      "datasourceUid": "__expr__",
      "queryType": "",
      "relativeTimeRange": {"from": 0, "to": 0}
    }
  ],
  "condition": "C",
  "evaluateFor": "5m",
  "noDataState": "NoData",
  "execErrState": "Alerting",
  "annotations": [
    {"key": "description", "value": "CPU usage is above 80%"},
    {"key": "summary", "value": "High CPU usage detected"}
  ],
  "labels": [
    {"key": "severity", "value": "warning"},
    {"key": "team", "value": "infrastructure"}
  ],
  "folder": {"title": "Generated Alerts", "uid": "generated-alerts"},
  "contactPoints": {
    "grafana": {
      "selectedContactPoint": "actual-contact-point-name",
      "overrideGrouping": false,
      "groupBy": [],
      "overrideTimings": false,
      "groupWaitValue": "",
      "groupIntervalValue": "",
      "repeatIntervalValue": "",
      "muteTimeIntervals": [],
      "activeTimeIntervals": []
    }
  }
}

Respond only with the JSON object, no additional text.`;

interface AlertRulePreviewProps {
  generatedRule: RuleFormValues;
  styles: ReturnType<typeof getStyles>;
}

const AlertRulePreview = ({ generatedRule, styles }: AlertRulePreviewProps) => {
  return (
    <div className={styles.preview}>
      <h4>
        <Trans i18nKey="alerting.generate-ai-rule.modal.preview-title">Generated Alert Rule Preview</Trans>
      </h4>
      <div className={styles.rulePreview}>
        <p>
          <strong>Name:</strong> {generatedRule.name}
        </p>
        <p>
          <strong>Evaluation Period:</strong> {generatedRule.evaluateFor}
        </p>
        <p>
          <strong>Queries:</strong> {generatedRule.queries?.length || 0} configured
        </p>
        {generatedRule.annotations && generatedRule.annotations.length > 0 && (
          <p>
            <strong>Description:</strong> {generatedRule.annotations.find((a) => a.key === 'description')?.value}
          </p>
        )}
        {generatedRule.contactPoints?.grafana?.selectedContactPoint && (
          <p>
            <strong>Contact Point:</strong> {generatedRule.contactPoints.grafana.selectedContactPoint}
          </p>
        )}
      </div>
    </div>
  );
};

export interface GenAIAlertRuleButtonProps {
  className?: string;
}

export const GenAIAlertRuleButton = ({ className }: GenAIAlertRuleButtonProps) => {
  const styles = useStyles2(getStyles);
  const location = useLocation();

  const [showModal, setShowModal] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [generatedRule, setGeneratedRule] = useState<RuleFormValues | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get contact points data for the tool
  const { data: contactPoints, isLoading: contactPointsLoading } = useListContactPointsv0alpha1();

  // Tool handler for getting contact points
  const handleGetContactPoints = useCallback(
    async (args: unknown) => {
      try {
        if (contactPointsLoading) {
          return {
            success: false,
            error: 'Contact points are still loading',
            contactPoints: [],
            count: 0,
          };
        }

        const processedContactPoints =
          contactPoints?.items.map((contactPoint) => ({
            name: contactPoint.spec.title,
            id: contactPoint.metadata.uid,
            provisioned: contactPoint.status.additionalFields?.provisioned,
            integrations: contactPoint.spec.integrations.map((integration) => ({
              type: integration.type,
              hasSettings: Object.keys(integration.settings || {}).length > 0,
            })),
            inUseByRoutes: contactPoint.status.operatorStates?.policies_count || 0,
            inUseByRules: contactPoint.status.operatorStates?.rules_count || 0,
          })) || [];

        return {
          success: true,
          contactPoints: processedContactPoints,
          count: processedContactPoints.length,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
          contactPoints: [],
          count: 0,
        };
      }
    },
    [contactPoints, contactPointsLoading]
  );

  // Sets up the AI's behavior and context
  const createSystemPrompt = (): Message => ({
    role: 'system',
    content: SYSTEM_PROMPT_CONTENT,
  });

  //  Contains the actual user request/query
  const createUserPrompt = (userInput: string): Message => ({
    role: 'user',
    content: `Create an alert rule for: ${userInput}

Please generate a complete alert rule configuration that monitors for this condition and includes appropriate thresholds, evaluation periods, and notification details.`,
  });

  // Parse and handle the LLM response
  const handleParsedResponse = useCallback((reply: string) => {
    try {
      const sanitizedReply = sanitizeReply(reply);
      const parsedRule = JSON.parse(sanitizedReply);

      // Merge with default values to ensure all required fields are present
      const defaultValues = getDefaultFormValues();
      const completeRule: RuleFormValues = {
        ...defaultValues,
        ...parsedRule,
        type: RuleFormType.grafana, // Ensure it's always Grafana-managed
      };

      setGeneratedRule(completeRule);
    } catch (error) {
      console.error('Failed to parse generated alert rule:', error);
      setError('Failed to parse the generated alert rule. Please try again.');
    }
  }, []);

  // Handle LLM call with tools
  const handleGenerateWithTools = useCallback(
    async (messages: Message[]) => {
      setIsGenerating(true);
      setError(null);

      try {
        const response = await llm.chatCompletions({
          model: DEFAULT_LLM_MODEL,
          messages,
          tools: [GET_CONTACT_POINTS_TOOL],
          temperature: 0.3,
        });

        const finalMessages = [...messages];

        // Handle tool calls if present
        if (response.choices[0]?.message?.tool_calls) {
          // Add the assistant's response with tool calls
          finalMessages.push({
            role: 'assistant', // identifies the assistant's response
            content: response.choices[0].message.content, // The actual text content of the response
            tool_calls: response.choices[0].message.tool_calls, // the function calls the AI wants to execute
          });

          // Process each tool call
          // This loops through each tool call that the AI assistant requested to execute.
          for (const toolCall of response.choices[0].message.tool_calls) {
            if (toolCall.function.name === 'get_contact_points') {
              // If the tool call is for getting contact points
              const args = JSON.parse(toolCall.function.arguments);
              const result = await handleGetContactPoints(args);

              // Add the tool result to the messages
              finalMessages.push({
                role: 'tool', //  Identifies this as a tool/function result
                content: JSON.stringify(result), // The result of the tool call
                tool_call_id: toolCall.id, // Links this result back to the specific tool call that generated it
              });
            }
          }

          // Call LLM again with the tool results
          // Make Second LLM Call with Tool Results to generate the final alert rule
          const finalResponse = await llm.chatCompletions({
            model: DEFAULT_LLM_MODEL,
            messages: finalMessages,
            tools: [GET_CONTACT_POINTS_TOOL],
            temperature: 0.3,
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
        console.error('Failed to generate alert rule with LLM:', error);
        setError('Failed to generate alert rule. Please try again.');
      } finally {
        setIsGenerating(false);
      }
    },
    [handleGetContactPoints, handleParsedResponse]
  );

  const handleGenerate = () => {
    if (!prompt.trim()) {
      return;
    }
    const messages: Message[] = [createSystemPrompt(), createUserPrompt(prompt)];

    handleGenerateWithTools(messages);
    logInfo(LogMessages.alertRuleFromScratch);
  };

  const handleUseRule = () => {
    if (!generatedRule) {
      return;
    }

    // Navigate to the alert rule form with the generated rule as prefill
    const ruleFormUrl = urlUtil.renderUrl('/alerting/new/alerting', {
      defaults: JSON.stringify(generatedRule),
      returnTo: location.pathname + location.search,
    });

    locationService.push(ruleFormUrl);
    setShowModal(false);
  };

  const handleClose = () => {
    setShowModal(false);
    setPrompt('');
    setGeneratedRule(null);
    setError(null);
  };

  return (
    <>
      <Button
        variant="secondary"
        icon="ai"
        onClick={() => setShowModal(true)}
        className={className}
        data-testid="generate-alert-rule-button"
      >
        <Trans i18nKey="alerting.generate-ai-rule.button">Generate with AI</Trans>
      </Button>

      <Modal
        title={t('alerting.generate-ai-rule.modal.title', 'Generate Alert Rule with AI')}
        isOpen={showModal}
        onDismiss={handleClose}
        className={styles.modal}
      >
        <Stack direction="column" gap={3}>
          <Field
            label={t('alerting.generate-ai-rule.modal.prompt-label', 'Describe the alert rule you want to create')}
            description={t(
              'alerting.generate-ai-rule.modal.prompt-description',
              'Describe what you want to monitor and when you want to be alerted. For example: "Alert when CPU usage is above 80% for more than 5 minutes". You can also ask about available contact points.'
            )}
            noMargin
          >
            <TextArea
              value={prompt}
              onChange={(e) => setPrompt(e.currentTarget.value)}
              placeholder={t(
                'alerting.generate-ai-rule.modal.prompt-placeholder',
                'Alert when disk usage is above 90% for more than 5 minutes and send to Slack contact point...'
              )}
              rows={4}
              disabled={isGenerating}
            />
          </Field>

          {error && (
            <div className={styles.error}>
              <Trans i18nKey="alerting.generate-ai-rule.modal.error">{error}</Trans>
            </div>
          )}

          {generatedRule && <AlertRulePreview generatedRule={generatedRule} styles={styles} />}

          <Stack direction="row" justifyContent="flex-end" gap={2}>
            <Button variant="secondary" onClick={handleClose}>
              <Trans i18nKey="common.cancel">Cancel</Trans>
            </Button>
            {!generatedRule && (
              <Button
                variant="primary"
                onClick={handleGenerate}
                disabled={!prompt.trim() || isGenerating}
                icon={isGenerating ? 'spinner' : 'ai'}
              >
                {isGenerating ? (
                  <Trans i18nKey="alerting.generate-ai-rule.modal.generating">Generating...</Trans>
                ) : (
                  <Trans i18nKey="alerting.generate-ai-rule.modal.generate">Generate Rule</Trans>
                )}
              </Button>
            )}
            {generatedRule && (
              <Button variant="primary" onClick={handleUseRule} icon="plus">
                <Trans i18nKey="alerting.generate-ai-rule.modal.use-rule">Use This Rule</Trans>
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
    width: '600px',
    maxWidth: '90vw',
  }),
  error: css({
    color: theme.colors.error.text,
    backgroundColor: theme.colors.error.main,
    padding: theme.spacing(1),
    borderRadius: theme.shape.radius.default,
  }),
  preview: css({
    backgroundColor: theme.colors.background.secondary,
    padding: theme.spacing(2),
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.medium}`,
  }),
  rulePreview: css({
    marginTop: theme.spacing(1),
    '& p': {
      margin: theme.spacing(0.5, 0),
    },
  }),
});
