import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';

/** Shared by the editor and the fallback shown while its lazy chunk loads, so content does not shift when it mounts. */
export const getEditorLayoutStyles = (theme: GrafanaTheme2) => {
  // Padding CodeMirror's own content instead of the pane keeps the raw text
  // aligned with the rendered preview when switching views.
  const codeMirrorPadding = {
    '.cm-content': { padding: theme.spacing(1, 0) },
    '.cm-line': { padding: theme.spacing(0, 2) },
    '.cm-gutters': { paddingLeft: theme.spacing(1) },
  };

  return {
    wrapper: css({
      label: 'textNGEditor',
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      width: '100%',
      height: '100%',
    }),
    body: css({
      display: 'flex',
      flex: 1,
      width: '100%',
      minHeight: 0,
    }),
    splitBody: css({
      gap: theme.spacing(1),
    }),
    pane: css({
      flex: 1,
      minWidth: 0,
      overflow: 'hidden',
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
    }),
    editorPane: css({
      display: 'flex',
      flexDirection: 'column',
      // Give CodeMirror a bounded height so it scrolls internally instead of growing.
      '& > *': {
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
      },
      ...codeMirrorPadding,
    }),
    previewPane: css({
      overflow: 'auto',
      background: theme.colors.background.primary,
      ...codeMirrorPadding,
    }),
    // Rendered markdown and HTML bring no padding of their own.
    htmlPreviewPane: css({
      padding: theme.spacing(1, 2),
    }),
  };
};
