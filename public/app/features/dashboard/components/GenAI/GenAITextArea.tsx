import { css } from '@emotion/css';

import { AITextArea } from '@grafana/assistant';
import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { TextArea, useStyles2 } from '@grafana/ui';

import { useIsAssistantAvailable } from './hooks';

const DESCRIPTION_USER_PROMPT_INSTRUCTION =
  'Generate a description - no markdown, no title or reasoning, just the description.';

export interface GenAITextAreaProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  systemPrompt?: string;
  userPrompt?: string;
  autoGenerate?: boolean;
  id?: string;
  'data-testid'?: string;
}

function buildDescriptionUserPrompt(textInput: string, userPrompt?: string): string {
  const parts = [DESCRIPTION_USER_PROMPT_INSTRUCTION];

  if (userPrompt) {
    parts.push(`Panel context:\n${userPrompt}`);
  }

  const trimmedInput = textInput.trim();
  if (trimmedInput) {
    parts.push(`User request: ${trimmedInput}`);
  }

  return parts.join('\n\n');
}

function buildDescriptionSystemPrompt(
  systemPrompt?: string,
  userPrompt?: string,
  includeContext = false
): string | undefined {
  if (!systemPrompt) {
    return undefined;
  }

  if (!includeContext || !userPrompt) {
    return systemPrompt;
  }

  return [systemPrompt, `Panel context:\n${userPrompt}`].join('\n\n');
}

/**
 * A text area that uses the Grafana Assistant for AI generation when available,
 * falling back to a plain TextArea otherwise.
 */
export function GenAITextArea({
  value,
  onChange,
  onComplete,
  onBlur,
  onFocus,
  systemPrompt,
  userPrompt,
  autoGenerate = false,
  id,
  'data-testid': dataTestId,
}: GenAITextAreaProps) {
  const isAssistant = useIsAssistantAvailable();
  const styles = useStyles2(getStyles);
  const isAutoGeneration = autoGenerate && isAssistant;
  const effectiveSystemPrompt = buildDescriptionSystemPrompt(systemPrompt, userPrompt, isAutoGeneration);

  if (isAssistant) {
    return (
      <AITextArea
        data-testid={dataTestId}
        value={value}
        onChange={onChange}
        onComplete={onComplete}
        systemPrompt={effectiveSystemPrompt}
        origin="grafana/panel-metadata/description"
        placeholder={t('gen-ai.text-area.placeholder', 'Type a description or let AI generate one...')}
        autoGenerate={autoGenerate}
        streaming
        getUserPrompt={(textInput) => buildDescriptionUserPrompt(textInput, isAutoGeneration ? undefined : userPrompt)}
        className={styles.assistantTextArea}
      />
    );
  }

  return (
    <TextArea
      id={id}
      data-testid={dataTestId}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      onBlur={onBlur}
      onFocus={onFocus}
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  assistantTextArea: css({
    // Keep the AI action button inside narrow scrollable panes.
    '& button[aria-label="Generate with AI"]': {
      right: `calc(${theme.spacing(1)} + ${theme.spacing(0.5)}) !important`,
    },
  }),
});
