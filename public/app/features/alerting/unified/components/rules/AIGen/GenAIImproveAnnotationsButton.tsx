import { css } from '@emotion/css';
import { useCallback, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { llm } from '@grafana/llm';
import { Button, Field, Modal, Stack, TextArea, useStyles2 } from '@grafana/ui';

import { RuleFormValues } from '../../../types/rule-form';
import { callLLM, extractJsonFromLLMResponse, formatLLMError } from '../../../utils/llmUtils';

import { createAnnotationsSystemPrompt, createAnnotationsUserPrompt } from './improvePrompt';

export interface GenAIImproveAnnotationsButtonProps {
  disabled?: boolean;
}

interface AnnotationsImprovementResult {
  annotations?: Array<{ key: string; value: string }>;
}

interface AnnotationsImprovementPreviewProps {
  improvements: AnnotationsImprovementResult;
  styles: ReturnType<typeof getStyles>;
  onApply: () => void;
  onCancel: () => void;
}

const AnnotationsImprovementPreview = ({
  improvements,
  styles,
  onApply,
  onCancel,
}: AnnotationsImprovementPreviewProps) => {
  return (
    <div className={styles.preview}>
      <h4>
        <Trans i18nKey="alerting.improve-ai-annotations.modal.preview-title">AI Annotations Improvements Preview</Trans>
      </h4>
      <div className={styles.improvementPreview}>
        {improvements.annotations && improvements.annotations.length > 0 && (
          <div className={styles.improvementSection}>
            <strong>
              <Trans i18nKey="alerting.improve-ai-annotations.modal.preview-annotations">Improved Annotations:</Trans>
            </strong>
            <ul>
              {improvements.annotations.map((annotation, index) => (
                <li key={index}>
                  <code>{annotation.key}</code>: {annotation.value}
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
          <Trans i18nKey="alerting.improve-ai-annotations.modal.apply-improvements">
            Apply Annotation Improvements
          </Trans>
        </Button>
      </Stack>
    </div>
  );
};

export const GenAIImproveAnnotationsButton = ({ disabled }: GenAIImproveAnnotationsButtonProps) => {
  const styles = useStyles2(getStyles);
  const { watch, setValue } = useFormContext<RuleFormValues>();

  const [showModal, setShowModal] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [improvements, setImprovements] = useState<AnnotationsImprovementResult | null>(null);
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
      console.error('Failed to parse AI annotation improvements:', error);
      setError('Failed to parse the AI annotation improvements. Please try again.');
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const messages: llm.Message[] = [
        createAnnotationsSystemPrompt(),
        createAnnotationsUserPrompt(prompt, currentValues),
      ];
      const content = await callLLM(messages);
      handleParsedResponse(content);
    } catch (error) {
      console.error('Failed to generate annotation improvements with LLM:', error);
      setError(formatLLMError(error));
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, currentValues, handleParsedResponse]);

  const handleApplyImprovements = useCallback(() => {
    if (!improvements || !improvements.annotations) {
      return;
    }

    const currentAnnotations = currentValues.annotations || [];
    const mergedAnnotations = [...currentAnnotations];

    improvements.annotations.forEach((newAnnotation) => {
      const existingIndex = mergedAnnotations.findIndex((a) => a.key === newAnnotation.key);
      if (existingIndex >= 0) {
        mergedAnnotations[existingIndex] = newAnnotation;
      } else {
        mergedAnnotations.push(newAnnotation);
      }
    });

    setValue('annotations', mergedAnnotations);

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
        data-testid="improve-annotations-button"
      >
        <Trans i18nKey="alerting.improve-ai-annotations.button">Improve annotations with AI</Trans>
      </Button>

      <Modal
        title={t('alerting.improve-ai-annotations.modal.title', 'Improve Alert Rule Annotations with AI')}
        isOpen={showModal}
        onDismiss={handleClose}
        className={styles.modal}
      >
        <Stack direction="column" gap={3}>
          <Field
            label={t(
              'alerting.improve-ai-annotations.modal.prompt-label',
              'How would you like to improve the annotations?'
            )}
            description={t(
              'alerting.improve-ai-annotations.modal.prompt-description',
              'Describe what you want to improve about the alert rule annotations. For example: "Make the summary more descriptive", "Add troubleshooting steps to the description", or "Add runbook links".'
            )}
            noMargin
          >
            <TextArea
              value={prompt}
              onChange={(e) => setPrompt(e.currentTarget.value)}
              placeholder={t(
                'alerting.improve-ai-annotations.modal.prompt-placeholder',
                'Make the summary more descriptive and add troubleshooting steps to the description...'
              )}
              rows={4}
              disabled={isGenerating}
            />
          </Field>

          {error && (
            <div className={styles.error}>
              <Trans i18nKey="alerting.improve-ai-annotations.modal.error">{error}</Trans>
            </div>
          )}

          {improvements && (
            <AnnotationsImprovementPreview
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
                  <Trans i18nKey="alerting.improve-ai-annotations.modal.generating">Generating...</Trans>
                ) : (
                  <Trans i18nKey="alerting.improve-ai-annotations.modal.generate">Improve Annotations</Trans>
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
