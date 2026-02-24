import { useMemo } from 'react';

import { AITextArea } from '@grafana/assistant';
import { PanelData } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Dashboard, Panel } from '@grafana/schema';
import { TextArea } from '@grafana/ui';

import { buildDescriptionInputSystemPrompt } from './assistantContext';
import { useIsAssistantAvailable } from './hooks';

export interface GenAITextAreaProps {
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
}

/**
 * A text area that uses the Grafana Assistant for AI generation when available,
 * falling back to a plain TextArea otherwise.
 * The LLM-plugin addon button is handled separately via GenAIPanelDescriptionButton.
 */
export function GenAITextArea({
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
}: GenAITextAreaProps) {
  const isAssistant = useIsAssistantAvailable();

  const systemPrompt = useMemo(() => {
    if (!isAssistant) {
      return undefined;
    }
    return buildDescriptionInputSystemPrompt(panel, dashboard, data);
  }, [isAssistant, panel, dashboard, data]);

  if (isAssistant) {
    return (
      <AITextArea
        data-testid={dataTestId}
        value={value}
        onChange={onChange}
        onComplete={onComplete}
        systemPrompt={systemPrompt}
        origin="grafana/panel-metadata/description"
        placeholder={t('gen-ai.text-area.placeholder', 'Type a description or let AI generate one...')}
        autoGenerate={autoGenerate}
        streaming
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
