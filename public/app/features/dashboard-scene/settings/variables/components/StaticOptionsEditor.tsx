import { useEffect, useState } from 'react';

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
  const readOnly = useOptionsPaneReadOnly();
  // A missing value is written without the comma, so committing the draft again parses back to the same options
  const serializedOptions = options
    .map(({ text, value }) =>
      value === undefined ? serializeField(text) : `${serializeField(text)},${serializeField(value)}`
    )
    .join('\n');
  const [draft, setDraft] = useState(serializedOptions);
  // Undo/redo can replace options while the editor stays mounted.
  useEffect(() => {
    setDraft(serializedOptions);
  }, [serializedOptions]);

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

function serializeField(value: string | number | undefined): string {
  const text = String(value ?? '');
  return /[,"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
