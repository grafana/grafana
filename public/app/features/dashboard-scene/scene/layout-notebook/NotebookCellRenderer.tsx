import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { type NotebookCellItem } from './NotebookCellItem';
import { cellTypeRegistry } from './cells/cellTypeRegistry';

// A lone VizPanel fills its parent, so the parent needs a resolved height (not just
// min-height) or PanelChrome measures 0 and nothing shows.
const PANEL_HEIGHT = 300;

// Renders a single notebook cell: a panel cell delegates to its VizPanel (which brings its
// own PanelChrome), while markdown/code cells render bare via the cell type registry.
export function NotebookCellRenderer({ cell }: { cell: NotebookCellItem }) {
  const styles = useStyles2(getStyles);
  const { body, content, collapsed } = cell.useState();

  if (collapsed) {
    return <div className={styles.collapsed}>{cell.state.elementName}</div>;
  }

  if (body) {
    return (
      <div className={styles.panel}>
        <body.Component model={body} />
      </div>
    );
  }

  if (content) {
    const item = cellTypeRegistry.getIfExists(content.kind);
    if (!item) {
      return null;
    }
    const Renderer = item.render;
    return (
      <div className={styles.content}>
        <Renderer content={content} />
      </div>
    );
  }

  return null;
}

const getStyles = (theme: GrafanaTheme2) => ({
  panel: css({
    height: PANEL_HEIGHT,
    position: 'relative',
  }),
  content: css({
    padding: theme.spacing(1, 0),
  }),
  collapsed: css({
    padding: theme.spacing(1),
    color: theme.colors.text.secondary,
    fontStyle: 'italic',
  }),
});
