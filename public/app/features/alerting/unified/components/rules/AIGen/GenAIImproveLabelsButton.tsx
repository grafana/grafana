import { css } from '@emotion/css';
import { useCallback, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { llm } from '@grafana/llm';
import { Button, Field, Modal, Stack, TextArea, useStyles2 } from '@grafana/ui';

import { RuleFormValues } from '../../../types/rule-form';
import { callLLM, extractJsonFromLLMResponse, formatLLMError } from '../../../utils/llmUtils';

import { createLabelsSystemPrompt, createLabelsUserPrompt } from './improvePrompt';

export interface GenAIImproveLabelsButtonProps {
  disabled?: boolean;
}

interface LabelsImprovementResult {
  labels?: Array<{ key: string; value: string }>;
}

interface LabelsImprovementPreviewProps {
  improvements: LabelsImprovementResult;
  styles: ReturnType<typeof getStyles>;
  onApply: () => void;
  onCancel: () => void;
}

const LabelsImprovementPreview = ({ improvements, styles, onApply, onCancel }: LabelsImprovementPreviewProps) => {
  return (
    <div className={styles.preview}>
      <h4>
        <Trans i18nKey="alerting.improve-ai-labels.modal.preview-title">AI Labels Improvements Preview</Trans>
      </h4>
      <div className={styles.improvementPreview}>
        {improvements.labels && improvements.labels.length > 0 && (
          <div className={styles.improvementSection}>
            <strong>
              <Trans i18nKey="alerting.improve-ai-labels.modal.preview-labels">Improved Labels:</Trans>
            </strong>
            <ul>
              {improvements.labels.map((label, index) => (
                <li key={index}>
                  <code>{label.key}</code>: {label.value}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <Stack direction="row" justifyContent="flex-end" gap={2}>
        <Button variant="secondary" onClick={onCancel}>
          <Trans i18nKey="common.cancel">Cancel</Trans>
        </Button>
        <Button variant="primary" onClick={onApply}>
          <Trans i18nKey="alerting.improve-ai-labels.modal.apply-improvements">Apply Label Improvements</Trans>
        </Button>
      </Stack>
    </div>
  );
};

export const GenAIImproveLabelsButton = ({ disabled }: GenAIImproveLabelsButtonProps) => {
  const styles = useStyles2(getStyles);
  const { watch, setValue } = useFormContext<RuleFormValues>();

  const [showModal, setShowModal] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [improvements, setImprovements] = useState<LabelsImprovementResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Watch current form values
  const currentValues = watch();

  const handleParsedResponse = useCallback((reply: string) => {
    try {
      const cleanedReply = extractJsonFromLLMResponse(reply);
      const parsedImprovements = JSON.parse(cleanedReply);
      setImprovements(parsedImprovements);
    } catch (error) {
      console.error('Failed to parse AI label improvements:', error);
      setError('Failed to parse the AI label improvements. Please try again.');
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const messages: llm.Message[] = [createLabelsSystemPrompt(), createLabelsUserPrompt(prompt, currentValues)];
      const content = await callLLM(messages);
      handleParsedResponse(content);
    } catch (error) {
      console.error('Failed to generate label improvements with LLM:', error);
      setError(formatLLMError(error));
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, currentValues, handleParsedResponse]);

  const handleApplyImprovements = useCallback(() => {
    if (!improvements || !improvements.labels) {
      return;
    }

    const currentLabels = currentValues.labels || [];
    const mergedLabels = [...currentLabels];

    improvements.labels.forEach((newLabel) => {
      const existingIndex = mergedLabels.findIndex((l) => l.key === newLabel.key);
      if (existingIndex >= 0) {
        mergedLabels[existingIndex] = newLabel;
      } else {
        mergedLabels.push(newLabel);
      }
    });

    setValue('labels', mergedLabels);

    setShowModal(false);
    setImprovements(null);
    setPrompt('');
  }, [improvements, currentValues, setValue]);

  const handleClose = () => {
    setShowModal(false);
    setPrompt('');
    setImprovements(null);
    setError(null);
  };

  return (
    <>
      <Button
        icon="ai"
        size="sm"
        variant="primary"
        fill="text"
        onClick={() => setShowModal(true)}
        disabled={disabled}
        data-testid="improve-labels-button"
      >
        <Trans i18nKey="alerting.improve-ai-labels.button">Improve labels with AI</Trans>
      </Button>

      <Modal
        title={t('alerting.improve-ai-labels.modal.title', 'Improve Alert Rule Labels with AI')}
        isOpen={showModal}
        onDismiss={handleClose}
        className={styles.modal}
      >
        <Stack direction="column" gap={3}>
          <Field
            label={t('alerting.improve-ai-labels.modal.prompt-label', 'How would you like to improve the labels?')}
            description={t(
              'alerting.improve-ai-labels.modal.prompt-description',
              'Describe what you want to improve about the alert rule labels. For example: "Add severity and team labels", "Add environment labels for better categorization", or "Create dynamic severity based on query values".'
            )}
            noMargin
          >
            <TextArea
              value={prompt}
              onChange={(e) => setPrompt(e.currentTarget.value)}
              placeholder={t(
                'alerting.improve-ai-labels.modal.prompt-placeholder',
                'Add severity labels based on thresholds, team ownership, and environment categorization...'
              )}
              rows={4}
              disabled={isGenerating}
            />
          </Field>

          {error && (
            <div className={styles.error}>
              <Trans i18nKey="alerting.improve-ai-labels.modal.error">{error}</Trans>
            </div>
          )}

          {improvements && (
            <LabelsImprovementPreview
              improvements={improvements}
              styles={styles}
              onApply={handleApplyImprovements}
              onCancel={() => setImprovements(null)}
            />
          )}

          {!improvements && (
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
                  <Trans i18nKey="alerting.improve-ai-labels.modal.generating">Generating...</Trans>
                ) : (
                  <Trans i18nKey="alerting.improve-ai-labels.modal.generate">Improve Labels</Trans>
                )}
              </Button>
            </Stack>
          )}
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
  improvementPreview: css({
    marginTop: theme.spacing(1),
  }),
  improvementSection: css({
    marginBottom: theme.spacing(2),
    '& ul': {
      backgroundColor: theme.colors.background.primary,
      padding: theme.spacing(1),
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${theme.colors.border.weak}`,
      margin: theme.spacing(0.5, 0),
    },
    '& li': {
      marginBottom: theme.spacing(0.5),
    },
    '& code': {
      backgroundColor: theme.colors.background.secondary,
      padding: theme.spacing(0.25, 0.5),
      borderRadius: theme.shape.radius.default,
      fontSize: theme.typography.bodySmall.fontSize,
    },
  }),
});
