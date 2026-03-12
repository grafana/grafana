import { css } from '@emotion/css';

import { AITextArea } from '@grafana/assistant';
import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { TextArea, useStyles2 } from '@grafana/ui';

import { buildAutoGenerateSystemPrompt, buildGenAIPrompt } from './promptUtils';

const DESCRIPTION_USER_PROMPT_INSTRUCTION =
  'Generate a description - no markdown, no title or reasoning, just the description.';

export interface GenAITextAreaProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  /** When provided, renders AITextArea instead of a plain TextArea. */
  systemPrompt?: string;
  /** Called at generation time to get fresh context. */
  getContext?: () => string;
  autoGenerate?: boolean;
  id?: string;
  'data-testid'?: string;
}

/**
 * A text area that uses the Grafana Assistant for AI generation when available,
 * falling back to a plain TextArea otherwise.
 *
 * The caller decides which variant to render by passing or omitting `systemPrompt`.
 */
export function GenAITextArea({
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
}: GenAITextAreaProps) {
  const styles = useStyles2(getStyles);
  const effectiveSystemPrompt = autoGenerate
    ? buildAutoGenerateSystemPrompt(systemPrompt, DESCRIPTION_USER_PROMPT_INSTRUCTION, getContext)
    : systemPrompt;

  if (systemPrompt) {
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
        getUserPrompt={(textInput) => buildGenAIPrompt(DESCRIPTION_USER_PROMPT_INSTRUCTION, textInput, getContext)}
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
    '& button': {
      right: `calc(${theme.spacing(1)} + ${theme.spacing(0.5)}) !important`,
    },
  }),
});
