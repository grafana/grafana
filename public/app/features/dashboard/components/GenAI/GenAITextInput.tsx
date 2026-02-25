import { css } from '@emotion/css';

import { AITextInput } from '@grafana/assistant';
import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Input, useStyles2 } from '@grafana/ui';

import { useIsAssistantAvailable } from './hooks';

const TITLE_USER_PROMPT_INSTRUCTION =
  'Generate a title - no markdown, no description or reasoning, just the title.';

export interface GenAITextInputProps {
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
  inputRef?: React.Ref<HTMLInputElement>;
}

function buildTitleUserPrompt(textInput: string, userPrompt?: string): string {
  const parts = [TITLE_USER_PROMPT_INSTRUCTION];

  if (userPrompt) {
    parts.push(`Panel context:\n${userPrompt}`);
  }

  const trimmedInput = textInput.trim();
  if (trimmedInput) {
    parts.push(`User request: ${trimmedInput}`);
  }

  return parts.join('\n\n');
}

/**
 * A text input that uses the Grafana Assistant for AI generation when available,
 * falling back to a plain Input otherwise.
 */
export function GenAITextInput({
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
  inputRef,
}: GenAITextInputProps) {
  const isAssistant = useIsAssistantAvailable();
  const styles = useStyles2(getStyles);

  if (isAssistant) {
    return (
      <AITextInput
        data-testid={dataTestId}
        value={value}
        onChange={onChange}
        onComplete={onComplete}
        systemPrompt={systemPrompt}
        origin="grafana/panel-metadata/title"
        placeholder={t('gen-ai.text-input.placeholder', 'Type a title or let AI generate one...')}
        autoGenerate={autoGenerate}
        streaming
        getUserPrompt={(textInput) => buildTitleUserPrompt(textInput, userPrompt)}
        className={styles.assistantInput}
      />
    );
  }

  return (
    <Input
      ref={inputRef}
      data-testid={dataTestId}
      id={id}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      onBlur={onBlur}
      onFocus={onFocus}
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  assistantInput: css({
    // Keep the AI action button inside narrow scrollable panes.
    '& button[aria-label="Generate with AI"]': {
      marginRight: theme.spacing(0.5),
    },
  }),
});
