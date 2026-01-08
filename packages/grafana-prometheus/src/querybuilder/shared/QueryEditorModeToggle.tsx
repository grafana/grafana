// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/shared/QueryEditorModeToggle.tsx
import { t } from '@grafana/i18n';
import { RadioButtonGroup } from '@grafana/ui';

import { QueryEditorMode } from './types';

interface Props {
  mode: QueryEditorMode;
  onChange: (mode: QueryEditorMode) => void;
}

export function QueryEditorModeToggle({ mode, onChange }: Props) {
  const editorModes = [
    {
      label: t('grafana-prometheus.querybuilder.query-editor-mode-toggle.editor-modes.label-builder', 'Builder'),
      value: QueryEditorMode.Builder,
    },
    {
      label: t('grafana-prometheus.querybuilder.query-editor-mode-toggle.editor-modes.label-code', 'Code'),
      value: QueryEditorMode.Code,
    },
  ];
  return (
    <div data-testid={'QueryEditorModeToggle'}>
      <RadioButtonGroup options={editorModes} size="sm" value={mode} onChange={onChange} />
    </div>
  );
}
