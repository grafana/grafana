import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { type VizPanel } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import { type CellContentKind } from 'app/features/notebook/types';

import { type NotebookCellItem } from './NotebookCellItem';
import { cellTypeRegistry } from './cells/cellTypeRegistry';

// A lone VizPanel fills its parent, so the parent needs a resolved height (not just
// min-height) or PanelChrome measures 0 and nothing shows.
const PANEL_HEIGHT = 300;

// A notebook cell is one of two things: a panel (a chart) or narrative content (a markdown or
// code block). This chooses the matching renderer, or shows a compact placeholder when the cell
// is collapsed.
export function NotebookCellRenderer({ cell, isEditing }: { cell: NotebookCellItem; isEditing: boolean }) {
  const { body: panel, content: narrative, collapsed, elementName } = cell.useState();

  if (collapsed) {
    return <CollapsedCell name={elementName} />;
  }

  if (panel) {
    return <PanelCell panel={panel} />;
  }

  if (narrative) {
    return <NarrativeCell content={narrative} isEditing={isEditing} />;
  }

  return null;
}

// A chart cell: delegates to its VizPanel, which brings its own PanelChrome (title, menu, legend).
function PanelCell({ panel }: { panel: VizPanel }) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.panel}>
      <panel.Component model={panel} />
    </div>
  );
}

// A narrative cell: markdown or code, rendered by the component registered for its content kind.
function NarrativeCell({ content, isEditing }: { content: CellContentKind; isEditing: boolean }) {
  const styles = useStyles2(getStyles);

  const registered = cellTypeRegistry.getIfExists(content.kind);
  if (!registered) {
    return null;
  }

  const Renderer = registered.render;
  return (
    <div className={styles.content}>
      <Renderer content={content} isEditing={isEditing} />
    </div>
  );
}

// A collapsed cell: shows only the element name, whatever the cell's type.
function CollapsedCell({ name }: { name: string }) {
  const styles = useStyles2(getStyles);

  return <div className={styles.collapsed}>{name}</div>;
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
