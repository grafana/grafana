import { css } from '@emotion/css';
import { useCallback, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { llm } from '@grafana/llm';
import { Button, Field, Modal, Stack, TextArea, useStyles2 } from '@grafana/ui';

import { createSystemPrompt, createUserPrompt } from './prompt';

export interface GenAITemplateButtonProps {
  onTemplateGenerated: (template: string) => void;
  disabled?: boolean;
  className?: string;
}

export const GenAITemplateButton = ({ onTemplateGenerated, disabled, className }: GenAITemplateButtonProps) => {
  const styles = useStyles2(getStyles);
  const [showModal, setShowModal] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parse and handle the LLM response
  const handleParsedResponse = useCallback(
    (reply: string) => {
      try {
        // Extract template content from the response - handle code blocks and other formatting
        const cleanedReply = extractTemplateFromLLMResponse(reply);
        onTemplateGenerated(cleanedReply);
        setShowModal(false);
      } catch (error) {
        console.error('Failed to parse generated template:', error);
        setError('Failed to parse the generated template. Please try again.');
      }
    },
    [onTemplateGenerated]
  );

  // Extract template content from LLM response, handling markdown code blocks and other formatting
  const extractTemplateFromLLMResponse = (response: string): string => {
    // Remove leading/trailing quotes
    let cleaned = response.replace(/^"|"$/g, '');

    // Extract from markdown code blocks: ```go...``` or ```json...```, sometimes the LLM response is formatted like this
    // example: ```go
    // {{ range .Alerts }}
    // {{ end }}
    // ```
    const codeBlockMatch = cleaned.match(/```(?:go|text|template)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      cleaned = codeBlockMatch[1];
    }

    // Trim whitespace and return
    return cleaned.trim();
  };

  // Handle direct LLM call , in this case we are not using tools
  // We are injecting directly the templates examples into the prompt (see createUserPrompt)
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Check if LLM service is available
      const enabled = await llm.enabled();
      if (!enabled) {
        throw new Error('LLM service is not configured or enabled');
      }

      const messages: llm.Message[] = [createSystemPrompt(), createUserPrompt(prompt)];

      const response = await llm.chatCompletions({
        model: llm.Model.LARGE, // Use LARGE model for better results
        messages,
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        handleParsedResponse(content);
      } else {
        throw new Error('No response content from LLM');
      }
    } catch (error) {
      console.error('Failed to generate template with LLM:', error);
      setError(`LLM request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, handleParsedResponse]);

  const handleClose = () => {
    setShowModal(false);
    setPrompt('');
    setError(null);
  };

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        icon="ai"
        fill="text"
        onClick={() => setShowModal(true)}
        disabled={disabled}
        data-testid="generate-template-button"
      >
        <Trans i18nKey="alerting.templates.editor.generate-with-ai">Generate with AI</Trans>
      </Button>

      <Modal
        title={t('alerting.template-form.genai.modal.title', 'Generate Template with AI')}
        isOpen={showModal}
        onDismiss={handleClose}
        className={styles.modal}
      >
        <Stack direction="column" gap={3}>
          <Field
            label={t(
              'alerting.template-form.genai.modal.prompt-label',
              'Describe how you want your notification to look'
            )}
            description={t(
              'alerting.template-form.genai.modal.prompt-description',
              'Describe the format and content you want for your notification. For example: "A Slack message showing alert name, status, and a summary with emoji indicators" or "An email with a table of all firing alerts including their labels and start times".'
            )}
            noMargin
          >
            <TextArea
              value={prompt}
              onChange={(e) => setPrompt(e.currentTarget.value)}
              placeholder={t(
                'alerting.template-form.genai.modal.prompt-placeholder',
                'A Slack message that shows "🔥 ALERT: [AlertName] is firing" with a summary and link to view details...'
              )}
              rows={4}
              disabled={isGenerating}
            />
          </Field>

          {error && (
            <div className={styles.error}>
              <Trans i18nKey="alerting.template-form.genai.modal.error">{error}</Trans>
            </div>
          )}

          <Stack direction="row" justifyContent="flex-end" gap={2}>
            <Button variant="secondary" onClick={handleClose}>
              <Trans i18nKey="common.cancel">Cancel</Trans>
            </Button>
            <Button
              variant="primary"
              onClick={handleGenerate}
              disabled={!prompt.trim() || isGenerating}
              icon={isGenerating ? 'spinner' : 'ai'}
            >
              {isGenerating ? (
                <Trans i18nKey="alerting.template-form.genai.modal.generating">Generating...</Trans>
              ) : (
                <Trans i18nKey="alerting.template-form.genai.modal.generate">Generate Template</Trans>
              )}
            </Button>
          </Stack>
        </Stack>
      </Modal>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  modal: css({
    width: '50%',
    maxWidth: 600,
  }),
  error: css({
    color: theme.colors.error.text,
    marginBottom: theme.spacing(2),
  }),
});
