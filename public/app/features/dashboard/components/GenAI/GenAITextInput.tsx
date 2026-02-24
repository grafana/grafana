import { AITextInput } from '@grafana/assistant';
import { t } from '@grafana/i18n';
import { Input } from '@grafana/ui';

import { useIsAssistantAvailable } from './hooks';

export interface GenAITextInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  systemPrompt?: string;
  autoGenerate?: boolean;
  id?: string;
  'data-testid'?: string;
  inputRef?: React.Ref<HTMLInputElement>;
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
  autoGenerate = false,
  id,
  'data-testid': dataTestId,
  inputRef,
}: GenAITextInputProps) {
  const isAssistant = useIsAssistantAvailable();

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
