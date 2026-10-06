import { useState } from 'react';

import { type MetricFindValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { CodeMirrorEditor } from '@grafana/ui/unstable';
import { useOptionsPaneReadOnly } from 'app/features/dashboard/components/PanelEditor/OptionsPaneReadOnlyContext';

export function StaticOptionsEditor({
  options,
  onCommit,
}: {
  options: MetricFindValue[];
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(() => options.map(({ text, value }) => `${text},${value}`).join('\n'));
  const readOnly = useOptionsPaneReadOnly();

  return (
    <CodeMirrorEditor
      value={draft}
      onChange={setDraft}
      onBlur={onCommit}
      onSave={onCommit}
      height="300px"
      readOnly={readOnly}
      aria-label={t('dashboard-scene.static-options-editor.static-dimensions-csv', 'Static dimensions CSV')}
      basicSetup={{ lineNumbers: true, foldGutter: false, autocompletion: false, closeBrackets: false }}
    />
  );
}
