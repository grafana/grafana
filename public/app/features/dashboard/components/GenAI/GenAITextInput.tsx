import { css } from '@emotion/css';

import { AITextInput } from '@grafana/assistant';
import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Input, useStyles2 } from '@grafana/ui';

const TITLE_USER_PROMPT_INSTRUCTION = 'Generate a title - no markdown, no description or reasoning, just the title.';

export interface GenAITextInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  /** When provided, renders AITextInput instead of a plain Input. */
  systemPrompt?: string;
  /** Called at generation time to get fresh context. */
  getContext?: () => string;
  autoGenerate?: boolean;
  id?: string;
  'data-testid'?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}

/**
 * A text input that uses the Grafana Assistant for AI generation when available,
 * falling back to a plain Input otherwise.
 *
 * The caller decides which variant to render by passing or omitting `systemPrompt`.
 */
export function GenAITextInput({
  value,
  onChange,
  onComplete,
  onBlur,
  onFocus,
  systemPrompt,
  getContext,
  autoGenerate = false,
  id,
  'data-testid': dataTestId,
  inputRef,
}: GenAITextInputProps) {
  const styles = useStyles2(getStyles);

  if (systemPrompt) {
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
        getUserPrompt={(textInput) => {
          const parts = [TITLE_USER_PROMPT_INSTRUCTION];
          const ctx = getContext?.();
          if (ctx) {
            parts.push(`<context>\n${ctx}\n</context>`);
          }
          const trimmed = textInput.trim();
          if (trimmed) {
            parts.push(`User request: ${trimmed}`);
          }
          return parts.join('\n\n');
        }}
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
    '& button[aria-label="Generate with AI"]': {
      marginRight: theme.spacing(0.5),
    },
  }),
});
