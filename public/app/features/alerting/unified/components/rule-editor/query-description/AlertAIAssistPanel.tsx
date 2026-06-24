import { useMemo } from 'react';

import { type OpenAssistantProps, createAssistantContextItem, useAssistant, useInlineAssistant } from '@grafana/assistant';
import { t } from '@grafana/i18n';
import { Button, Stack } from '@grafana/ui';

import { compileQueryDescription } from './compileQueryDescription';

interface AlertAIAssistPanelProps {
  summaryInput?: { expr: string; threshold?: { comparator: string; value: number } };
  ruleName: string;
  summary: string;
  description: string;
  onSummaryGenerated: (text: string) => void;
  onDescriptionGenerated: (text: string) => void;
}

export function AlertAIAssistPanel({
  summaryInput,
  ruleName,
  summary,
  description,
  onSummaryGenerated,
  onDescriptionGenerated,
}: AlertAIAssistPanelProps) {
  const { isAvailable, openAssistant } = useAssistant();
  const { generate, isGenerating, cancel } = useInlineAssistant();

  const compiled = useMemo(() => {
    if (!summaryInput) {
      return undefined;
    }
    return compileQueryDescription(summaryInput.expr, {
      threshold: summaryInput.threshold,
    });
  }, [summaryInput]);

  const contextItem = useMemo(() => {
    if (!summaryInput || !compiled) {
      return undefined;
    }

    return createAssistantContextItem('structured', {
      title: `Alert rule: ${ruleName}`,
      data: {
        ruleName,
        query: summaryInput.expr,
        threshold: summaryInput.threshold,
        deterministicDescription: compiled.text,
        summary,
        description,
      },
    });
  }, [summaryInput, compiled, ruleName, summary, description]);

  if (!isAvailable || !summaryInput || !compiled) {
    return null;
  }

  const buildContext = () =>
    `Rule: ${ruleName}\nQuery: ${summaryInput.expr}\n` +
    `Threshold: ${summaryInput.threshold?.comparator ?? ''} ${summaryInput.threshold?.value ?? ''}\n` +
    `Deterministic description: ${compiled.text}\n` +
    `Current summary: ${summary}\nCurrent description: ${description}`;

  const handlePolish = () => {
    generate({
      prompt:
        buildContext() +
        '\n\nRewrite this alert into two fields:\n' +
        'SUMMARY: A clear 1-2 sentence summary of what the alert monitors and when it fires.\n' +
        'DESCRIPTION: A concise explanation with context an on-call engineer needs — what to check, expected ranges, and next steps.\n\n' +
        'Output exactly two lines:\nSUMMARY: <text>\nDESCRIPTION: <text>',
      origin: 'grafana/alerting/polish-summary',
      systemPrompt:
        'You are an expert SRE. Rewrite alert annotations to be concise and actionable. ' +
        'Preserve metric names, thresholds, and technical accuracy. ' +
        'Output exactly two lines in the format SUMMARY: <text> and DESCRIPTION: <text>. No other output.',
      onComplete: (text) => {
        const summaryMatch = text.match(/SUMMARY:\s*(.+)/i);
        const descMatch = text.match(/DESCRIPTION:\s*(.+)/i);
        if (summaryMatch) {
          onSummaryGenerated(summaryMatch[1].trim());
        }
        if (descMatch) {
          onDescriptionGenerated(descMatch[1].trim());
        }
      },
    });
  };

  const handleReview = () => {
    if (!openAssistant || !contextItem) {
      return;
    }
    openAssistant({
      origin: 'alerting/review-summary',
      mode: 'assistant',
      prompt:
        'Act as a skeptical on-call engineer woken at 3 AM by this alert. List concrete gaps: what should you check first, what are normal vs bad value ranges, is a runbook linked, is the severity clear? Suggest specific fixes before saving this rule.',
      context: [contextItem],
      autoSend: true,
    } satisfies OpenAssistantProps);
  };

  return (
    <Stack direction="row" gap={1}>
      <Button type="button" icon="ai-sparkle" variant="secondary" size="sm" onClick={handlePolish} disabled={isGenerating}>
        {isGenerating
          ? t('alerting.query-description.generating', 'Generating...')
          : t('alerting.query-description.polish-summary', 'Polish summary with Assistant')}
      </Button>
      {isGenerating && (
        <Button type="button" variant="destructive" size="sm" fill="text" onClick={cancel}>
          {t('alerting.query-description.stop', 'Stop')}
        </Button>
      )}
      <Button type="button" icon="ai-sparkle" variant="secondary" size="sm" onClick={handleReview} disabled={isGenerating}>
        {t('alerting.query-description.review-oncall', 'Review like a tired on-call engineer')}
      </Button>
    </Stack>
  );
}
