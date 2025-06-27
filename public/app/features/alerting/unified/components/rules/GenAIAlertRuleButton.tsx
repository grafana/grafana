import { css } from '@emotion/css';
import { useCallback, useState } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { GrafanaTheme2, urlUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Button, Field, Modal, Stack, TextArea, useStyles2 } from '@grafana/ui';

import { StreamStatus, useLLMStream } from '../../../../dashboard/components/GenAI/hooks';
import { DEFAULT_LLM_MODEL, Message, sanitizeReply } from '../../../../dashboard/components/GenAI/utils';
import { LogMessages, logInfo } from '../../Analytics';
import { getDefaultFormValues } from '../../rule-editor/formDefaults';
import { RuleFormType, RuleFormValues } from '../../types/rule-form';

const SYSTEM_PROMPT_CONTENT = `You are an expert in creating Grafana alert rules. Based on the user's description, generate a properly structured alert rule configuration.

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

For queries, include:
- A data query (refId: "A") from appropriate datasource
- A condition query (refId: "C") that evaluates the data

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
  "folder": {"title": "Generated Alerts", "uid": "generated-alerts"}
}
  example of a real object:
  {
    "name": "test",
    "uid": "",
    "labels": [
        {
            "key": "",
            "value": ""
        }
    ],
    "annotations": [
        {
            "key": "summary",
            "value": ""
        },
        {
            "key": "description",
            "value": ""
        },
        {
            "key": "runbook_url",
            "value": ""
        }
    ],
    "dataSourceName": "grafana",
    "type": "grafana-alerting",
    "group": "ALERT",
    "folder": {
        "title": "de4ikvdnxa0w0b",
        "uid": "de4ikvdnxa0w0b"
    },
    "queries": [
        {
            "refId": "A",
            "queryType": "",
            "relativeTimeRange": {
                "from": 600,
                "to": 0
            },
            "datasourceUid": "PD8C576611E62080A",
            "model": {
                "intervalMs": 1000,
                "maxDataPoints": 43200,
                "refId": "A"
            }
        },
        {
            "refId": "B",
            "queryType": "",
            "relativeTimeRange": {
                "from": 0,
                "to": 0
            },
            "datasourceUid": "__expr__",
            "model": {
                "conditions": [
                    {
                        "evaluator": {
                            "params": [],
                            "type": "gt"
                        },
                        "operator": {
                            "type": "and"
                        },
                        "query": {
                            "params": [
                                "B"
                            ]
                        },
                        "reducer": {
                            "params": [],
                            "type": "last"
                        },
                        "type": "query"
                    }
                ],
                "datasource": {
                    "type": "__expr__",
                    "uid": "__expr__"
                },
                "expression": "A",
                "intervalMs": 1000,
                "maxDataPoints": 43200,
                "reducer": "last",
                "refId": "B",
                "type": "reduce"
            }
        },
        {
            "refId": "C",
            "queryType": "",
            "relativeTimeRange": {
                "from": 0,
                "to": 0
            },
            "datasourceUid": "__expr__",
            "model": {
                "conditions": [
                    {
                        "evaluator": {
                            "params": [
                                0
                            ],
                            "type": "gt"
                        },
                        "operator": {
                            "type": "and"
                        },
                        "query": {
                            "params": [
                                "C"
                            ]
                        },
                        "reducer": {
                            "params": [],
                            "type": "last"
                        },
                        "type": "query"
                    }
                ],
                "datasource": {
                    "type": "__expr__",
                    "uid": "__expr__"
                },
                "expression": "B",
                "intervalMs": 1000,
                "maxDataPoints": 43200,
                "refId": "C",
                "type": "threshold"
            }
        }
    ],
    "recordingRulesQueries": [],
    "condition": "C",
    "noDataState": "NoData",
    "execErrState": "Error",
    "evaluateFor": "1m",
    "keepFiringFor": "0s",
    "evaluateEvery": "1m",
    "manualRouting": true,
    "contactPoints": {
        "grafana": {
            "selectedContactPoint": "cp1",
            "muteTimeIntervals": [],
            "activeTimeIntervals": [],
            "overrideGrouping": false,
            "overrideTimings": false,
            "groupBy": [],
            "groupWaitValue": "",
            "groupIntervalValue": "",
            "repeatIntervalValue": ""
        }
    },
    "overrideGrouping": false,
    "overrideTimings": false,
    "muteTimeIntervals": [],
    "editorSettings": {
        "simplifiedQueryEditor": true,
        "simplifiedNotificationEditor": true
    },
    "namespace": "",
    "expression": "",
    "forTime": 1,
    "forTimeUnit": "m",
    "isPaused": false
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

  // Handles the LLM's response and parses it into a RuleFormValues object
  const onResponse = useCallback((reply: string) => {
    try {
      const sanitizedReply = sanitizeReply(reply);
      // Try to parse the JSON response
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
      // If parsing fails, we could show an error or try to extract JSON from the response
    }
  }, []);

  const { setMessages, streamStatus, error } = useLLMStream({
    model: DEFAULT_LLM_MODEL,
    temperature: 0.3, // Lower temperature for more consistent JSON output
    onResponse,
  });

  const isGenerating = streamStatus === StreamStatus.GENERATING;

  const handleGenerate = () => {
    if (!prompt.trim()) {
      return;
    }
    const messages: Message[] = [createSystemPrompt(), createUserPrompt(prompt)];

    setMessages(messages);
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
              'Describe what you want to monitor and when you want to be alerted. For example: "Alert when CPU usage is above 80% for more than 5 minutes"'
            )}
            noMargin
          >
            <TextArea
              value={prompt}
              onChange={(e) => setPrompt(e.currentTarget.value)}
              placeholder={t(
                'alerting.generate-ai-rule.modal.prompt-placeholder',
                'Alert when disk usage is above 90% for more than 5 minutes...'
              )}
              rows={4}
              disabled={isGenerating}
            />
          </Field>

          {error && (
            <div className={styles.error}>
              <Trans i18nKey="alerting.generate-ai-rule.modal.error">
                Failed to generate alert rule. Please try again.
              </Trans>
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
