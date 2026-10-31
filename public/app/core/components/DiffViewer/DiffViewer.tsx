import { css } from '@emotion/css';
import { type ReactElement } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { CodeMirrorDiffEditor as DiffEditor, type CodeMirrorDiffEditorProps } from '@grafana/ui/unstable';

import { InlineDiffToggle, useInlineDiffPreference } from '../MonacoDiffEditor/inlineDiffPreference';

/** Read-only CodeMirror diff with the shared, persisted view preference. */
export function DiffViewer({ height, inline, ...props }: CodeMirrorDiffEditorProps): ReactElement {
  const styles = useStyles2(getStyles);
  const [inlinePreference, setInlinePreference] = useInlineDiffPreference();
  const inlineDiff = inline ?? inlinePreference;

  return (
    <div className={styles.wrapper} style={{ height }}>
      {inline === undefined && (
        <div className={styles.toolbar}>
          <InlineDiffToggle value={inlineDiff} onChange={setInlinePreference} />
        </div>
      )}
      <div className={styles.editor}>
        <DiffEditor {...props} height="100%" inline={inlineDiff} />
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2): Record<'wrapper' | 'toolbar' | 'editor', string> => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    minHeight: 0,
  }),
  toolbar: css({
    display: 'flex',
    justifyContent: 'flex-end',
    flex: '0 0 auto',
  }),
  editor: css({
    flex: '1 1 auto',
    minHeight: 0,
  }),
});
