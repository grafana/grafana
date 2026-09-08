import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { ReactMonacoDiffEditor, type ReactMonacoDiffEditorProps, useStyles2 } from '@grafana/ui';

import { InlineDiffToggle, useInlineDiffPreference } from './inlineDiffPreference';

export type MonacoDiffEditorProps = ReactMonacoDiffEditorProps & {
  /**
   * Diff render mode. Leave undefined for self-contained mode: the editor renders its own
   * side-by-side/inline toggle and persists the user's choice. Pass a boolean to control the mode
   * from outside instead - the built-in toggle is then hidden and the consumer renders its own
   * (e.g. the dashboard code pane places it in the pane header).
   */
  inline?: boolean;
};

/** Read-only Monaco diff with a persisted side-by-side/inline preference shared across surfaces. */
export function MonacoDiffEditor({ options, height, inline, ...restProps }: MonacoDiffEditorProps) {
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
        <ReactMonacoDiffEditor
          {...restProps}
          height="100%"
          options={{
            readOnly: true,
            scrollBeyondLastLine: false,
            minimap: { enabled: false },
            automaticLayout: true,
            ...options,
            renderSideBySide: !inlineDiff,
          }}
        />
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
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
    flex: '1 1 0',
    minHeight: 0,
  }),
});
