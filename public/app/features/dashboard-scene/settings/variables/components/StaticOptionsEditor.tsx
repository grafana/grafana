import { useEffect, useRef, useState } from 'react';

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
  const serializedOptions = options.map(({ text, value }) => `${text},${value}`).join('\n');
  const [draft, setDraft] = useState(serializedOptions);
  const lastSerializedOptions = useRef(serializedOptions);
  const isCommitting = useRef(false);

  // Options can also change outside of the editor (e.g. undo/redo). Replace the draft then, but keep it
  // as typed when the change comes from committing the draft.
  useEffect(() => {
    if (serializedOptions !== lastSerializedOptions.current) {
      lastSerializedOptions.current = serializedOptions;
      if (!isCommitting.current) {
        setDraft(serializedOptions);
      }
    }
  }, [serializedOptions]);

  // A commit is handled by the render that follows it, even when it does not change the options
  useEffect(() => {
    isCommitting.current = false;
  });

  const commit = (value: string) => {
    isCommitting.current = true;
    onCommit(value);
  };

  return (
    <CodeMirrorEditor
      value={draft}
      onChange={setDraft}
      onBlur={commit}
      onSave={commit}
      height="300px"
      aria-label={t('dashboard-scene.static-options-editor.static-dimensions-csv', 'Static dimensions CSV')}
      basicSetup={{ lineNumbers: true, foldGutter: false, autocompletion: false, closeBrackets: false }}
    />
  );
}
