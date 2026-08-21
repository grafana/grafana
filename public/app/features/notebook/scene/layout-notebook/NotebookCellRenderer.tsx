import { css } from '@emotion/css';
import { Suspense } from 'react';

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
export function NotebookCellRenderer({
  cell,
  isEditing,
  autoFocus,
}: {
  cell: NotebookCellItem;
  isEditing: boolean;
  autoFocus?: boolean;
}) {
  const { body: panel, content: narrative, collapsed, elementName } = cell.useState();

  if (collapsed) {
    return <CollapsedCell name={elementName} />;
  }

  if (panel) {
    return <PanelCell panel={panel} />;
  }

  if (narrative) {
    return <NarrativeCell cell={cell} content={narrative} isEditing={isEditing} autoFocus={autoFocus} />;
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
//
// Edits go back through the layout manager rather than straight onto this cell, because a cell
// cannot see the siblings that may reference the same element. They end up on cell state, which is
// where transformNotebookSceneToSaveModel reads content from — so an export (and, later, a save)
// serializes what the reader actually sees. Nothing is persisted to the API yet.
function NarrativeCell({
  cell,
  content,
  isEditing,
  autoFocus,
}: {
  cell: NotebookCellItem;
  content: CellContentKind;
  isEditing: boolean;
  autoFocus?: boolean;
}) {
  const styles = useStyles2(getStyles);
  const registered = cellTypeRegistry.getIfExists(content.kind);
  if (!registered) {
    return null;
  }

  const Renderer = registered.render;
  return (
    <div className={styles.content}>
      <Suspense fallback={content.kind === 'Code' ? <pre>{content.spec.code}</pre> : null}>
        <Renderer
          content={content}
          isEditing={isEditing}
          autoFocus={autoFocus}
          onChange={(updated) => cell.onContentChange(updated)}
        />
      </Suspense>
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
