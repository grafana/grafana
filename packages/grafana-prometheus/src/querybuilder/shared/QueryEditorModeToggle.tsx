// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/shared/QueryEditorModeToggle.tsx
import { RadioButtonGroup } from '@grafana/ui';

import { QueryEditorMode } from './types';

export interface Props {
  mode: QueryEditorMode;
  onChange: (mode: QueryEditorMode) => void;
  hideBuilder?: boolean;
}

const editorModes = [
  { label: 'Builder', value: QueryEditorMode.Builder },
  { label: 'Code', value: QueryEditorMode.Code },
];

export function QueryEditorModeToggle({ mode, onChange, hideBuilder }: Props) {
  return (
    <div data-testid={'QueryEditorModeToggle'}>
      <RadioButtonGroup options={editorModes?.filter(
        (option) => !(hideBuilder && option.value === QueryEditorMode.Builder)
      )} size="sm" value={mode} onChange={onChange} />
    </div>
  );
}
