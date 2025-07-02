import { css } from '@emotion/css';
import { useCallback, useState } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { useListContactPointsv0alpha1 } from '@grafana/alerting/unstable';
import { GrafanaTheme2, urlUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { llm } from '@grafana/llm';
import { locationService } from '@grafana/runtime';
import { Button, Field, Modal, Stack, TextArea, useStyles2 } from '@grafana/ui';

import { LogMessages, logInfo } from '../../../Analytics';
import { getDefaultFormValues } from '../../../rule-editor/formDefaults';
import { RuleFormType, RuleFormValues } from '../../../types/rule-form';

import {
  GET_CONTACT_POINTS_TOOL,
  GET_DATA_SOURCES_TOOL,
  createSystemPrompt,
  createUserPrompt,
  handleGetContactPoints,
  handleGetDataSources,
} from './prompt';

// TODO:
// - Create tool for getting folders ?
// - Create tool for getting groups ?

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
          <strong>
            <Trans i18nKey="alerting.generate-ai-rule.modal.preview-name">Name:</Trans>
          </strong>{' '}
          {generatedRule.name}
        </p>
        <p>
          <strong>
            <Trans i18nKey="alerting.generate-ai-rule.modal.preview-evaluation-period">Evaluation Period:</Trans>
          </strong>{' '}
          {generatedRule.evaluateFor}
        </p>
        <p>
          <strong>
            <Trans i18nKey="alerting.generate-ai-rule.modal.preview-queries">Queries:</Trans>
          </strong>{' '}
          {generatedRule.queries?.length || 0}{' '}
          <Trans i18nKey="alerting.generate-ai-rule.modal.preview-configured">configured</Trans>
        </p>
        {generatedRule.annotations && generatedRule.annotations.length > 0 && (
          <p>
            <strong>
              <Trans i18nKey="alerting.generate-ai-rule.modal.preview-description">Description:</Trans>
            </strong>{' '}
            {generatedRule.annotations.find((a) => a.key === 'description')?.value}
          </p>
        )}
        {generatedRule.contactPoints?.grafana?.selectedContactPoint && (
          <p>
            <strong>
              <Trans i18nKey="alerting.generate-ai-rule.modal.preview-contact-point">Contact Point:</Trans>
            </strong>{' '}
            {generatedRule.contactPoints.grafana.selectedContactPoint}
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

  // get contact points data for injecting into the prompt
  const { data: contactPointsData, isLoading: contactPointsLoading } = useListContactPointsv0alpha1();

  const [showModal, setShowModal] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [generatedRule, setGeneratedRule] = useState<RuleFormValues | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parse and handle the LLM response
  const handleParsedResponse = useCallback((reply: string) => {
    try {
      // Extract JSON from the response - handle code blocks and other formatting
      const cleanedReply = extractJsonFromLLMResponse(reply);
      const parsedRule = JSON.parse(cleanedReply);

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

  // Extract JSON from LLM response, handling markdown code blocks and other formatting
  const extractJsonFromLLMResponse = (response: string): string => {
    // Remove leading/trailing quotes
    let cleaned = response.replace(/^"|"$/g, '');

    // Try to extract JSON from markdown code blocks, sometimes the LLM response is formatted like this
    // example: ```json
    // {
    //   "name": "Alert Rule",
    //   "description": "Alert when CPU usage is above 80% for more than 5 minutes",
    //   "query": "cpu_usage > 80",
    // }
    // ```
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
      cleaned = codeBlockMatch[1];
    }

    // If no code block, try to find JSON object boundaries
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    // Trim whitespace
    return cleaned.trim();
  };

  // Handle LLM call with tools: in this case we are using tools to get contact points and data sources
  const handleGenerateWithTools = useCallback(
    async (messages: llm.Message[]) => {
      setIsGenerating(true);
      setError(null);

      try {
        // Check if LLM service is available
        const enabled = await llm.enabled();
        if (!enabled) {
          throw new Error('LLM service is not configured or enabled');
        }

        const response = await llm.chatCompletions({
          model: llm.Model.LARGE, // Use LARGE model for better results
          messages,
          tools: [GET_CONTACT_POINTS_TOOL, GET_DATA_SOURCES_TOOL],
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
              const result = await handleGetContactPoints(args, contactPointsData, contactPointsLoading);

              // Add the tool result to the messages
              finalMessages.push({
                role: 'tool', //  Identifies this as a tool/function result
                content: JSON.stringify(result), // The result of the tool call
                tool_call_id: toolCall.id, // Links this result back to the specific tool call that generated it
              });
            } else if (toolCall.function.name === 'get_data_sources') {
              // If the tool call is for getting data sources
              const args = JSON.parse(toolCall.function.arguments);
              const result = await handleGetDataSources(args);

              // Add the tool result to the messages
              finalMessages.push({
                role: 'tool',
                content: JSON.stringify(result),
                tool_call_id: toolCall.id,
              });
            }
          }

          // Call LLM again with the tool results
          // Make Second LLM Call with Tool Results to generate the final alert rule
          const finalResponse = await llm.chatCompletions({
            model: llm.Model.LARGE, // Use LARGE model for better results
            messages: finalMessages,
            tools: [GET_CONTACT_POINTS_TOOL, GET_DATA_SOURCES_TOOL],
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
        setError(`LLM request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsGenerating(false);
      }
    },
    [handleParsedResponse, contactPointsData, contactPointsLoading]
  );

  const handleGenerate = () => {
    if (!prompt.trim()) {
      return;
    }
    const messages: llm.Message[] = [createSystemPrompt(), createUserPrompt(prompt)];

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
        icon="ai"
        fill="text"
        onClick={() => setShowModal(true)}
        data-testid="generate-alert-rule-button"
        variant="primary"
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
              'Describe what you want to monitor and when you want to be alerted. For example: "Alert when CPU usage is above 80% for more than 5 minutes". You can also ask about available contact points or data sources.'
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
