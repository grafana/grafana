import { keymap } from '@codemirror/view';
import { unparse } from 'papaparse';
import { useMemo, useState } from 'react';

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
  const [draft, setDraft] = useState(() =>
    unparse(
      options.map(({ text, value }) => [text, value]),
      { newline: '\n' }
    )
  );
  const extensions = useMemo(
    () => [
      keymap.of([
        {
          key: 'Mod-s',
          run: (view) => {
            onCommit(view.state.doc.toString());
            return true;
          },
          preventDefault: true,
        },
      ]),
    ],
    [onCommit]
  );

  return (
    <CodeMirrorEditor
      value={draft}
      onChange={setDraft}
      onBlur={onCommit}
      height="300px"
      aria-label={t('dashboard-scene.static-options-editor.static-dimensions-csv', 'Static dimensions CSV')}
      basicSetup={{ lineNumbers: true, foldGutter: false, autocompletion: false, closeBrackets: false }}
      extensions={extensions}
    />
  );
}
