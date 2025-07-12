import { css } from '@emotion/css';
import { useCallback, useState } from 'react';

import { GrafanaTheme2, TimeRange, renderMarkdown } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { llm } from '@grafana/llm';
import { Button, Modal, Stack, Text, TextArea, useStyles2 } from '@grafana/ui';

import { callLLM, formatLLMError } from '../../../../utils/llmUtils';
import { LogRecord } from '../../state-history/common';

import { createSystemPrompt, createUserPrompt } from './prompt';

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
      <div
        className={styles.analysisContent}
        dangerouslySetInnerHTML={{
          // renderMarkdown() converts markdown text into safe HTML
          __html: renderMarkdown(analysis),
        }}
      />
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

  const systemPrompt = createSystemPrompt();

  // Handle LLM call without tools: we inject the log records into the prompt instead of using tools
  const handleAnalyze = useCallback(async () => {
    if (logRecords.length === 0) {
      setError('No alert events available to analyze');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      // Create the user prompt with the log records and the custom question
      const userPrompt = createUserPrompt(logRecords, timeRange, customQuestion.trim() || undefined);
      const messages: llm.Message[] = [systemPrompt, userPrompt];
      const content = await callLLM(messages);
      setAnalysis(content);
    } catch (error) {
      console.error('Failed to analyze alerts with LLM:', error);
      setError(formatLLMError(error));
    } finally {
      setIsAnalyzing(false);
    }
  }, [systemPrompt, customQuestion, timeRange, logRecords]);

  const handleClose = () => {
    setShowModal(false);
    setAnalysis(null);
    setError(null);
    setCustomQuestion('');
  };

  return (
    <>
      <Button
        variant="primary"
        icon="ai"
        fill="text"
        onClick={() => setShowModal(true)}
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
