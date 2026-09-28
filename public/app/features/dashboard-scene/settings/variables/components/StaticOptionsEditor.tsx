import { useState } from 'react';

import { type MetricFindValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { CodeMirrorEditor } from '@grafana/ui/unstable';

export function StaticOptionsEditor({
  options,
  onCommit,
}: {
  options: MetricFindValue[];
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(() => options.map(({ text, value }) => `${text},${value}`).join('\n'));

  return (
    <CodeMirrorEditor
      value={draft}
      onChange={setDraft}
      onBlur={onCommit}
      onSave={onCommit}
      height="300px"
      aria-label={t('dashboard-scene.static-options-editor.static-dimensions-csv', 'Static dimensions CSV')}
      basicSetup={{ lineNumbers: true, foldGutter: false, autocompletion: false, closeBrackets: false }}
    />
  );
}
