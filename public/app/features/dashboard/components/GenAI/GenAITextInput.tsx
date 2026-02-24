import { useMemo } from 'react';

import { AITextInput } from '@grafana/assistant';
import { PanelData } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Dashboard, Panel } from '@grafana/schema';
import { Input } from '@grafana/ui';

import { buildTitleInputSystemPrompt } from './assistantContext';
import { useIsAssistantAvailable } from './hooks';

export interface GenAITextInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  panel: Panel;
  dashboard: Dashboard;
  data?: PanelData;
  autoGenerate?: boolean;
  id?: string;
  'data-testid'?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}

/**
 * A text input that uses the Grafana Assistant for AI generation when available,
 * falling back to a plain Input otherwise.
 * The LLM-plugin addon button is handled separately via GenAIPanelTitleButton.
 */
export function GenAITextInput({
  value,
  onChange,
  onComplete,
  onBlur,
  onFocus,
  panel,
  dashboard,
  data,
  autoGenerate = false,
  id,
  'data-testid': dataTestId,
  inputRef,
}: GenAITextInputProps) {
  const isAssistant = useIsAssistantAvailable();

  const systemPrompt = useMemo(() => {
    if (!isAssistant) {
      return undefined;
    }
    return buildTitleInputSystemPrompt(panel, dashboard, data);
  }, [isAssistant, panel, dashboard, data]);

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
