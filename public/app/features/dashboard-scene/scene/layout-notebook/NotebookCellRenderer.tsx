import { css } from '@emotion/css';

import { rangeUtil, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type VizPanel } from '@grafana/scenes';
import { type CellContentKind } from '@grafana/schema/apis/notebook/v2beta1';
import { Icon, Text, useStyles2 } from '@grafana/ui';

import { type NotebookCellItem } from './NotebookCellItem';
import { cellTypeRegistry } from './cells/cellTypeRegistry';

// A lone VizPanel fills its parent, so the parent needs a resolved height (not just
// min-height) or PanelChrome measures 0 and nothing shows.
const DEFAULT_PANEL_HEIGHT = 300;

// A notebook cell is one of two things: a panel (a chart) or narrative content (a markdown or
// code block). This chooses the matching renderer, or shows a compact placeholder when the cell
// is collapsed.
export function NotebookCellRenderer({ cell }: { cell: NotebookCellItem }) {
  const { body: panel, content: narrative, collapsed, elementName, height, timeFrom, timeTo } = cell.useState();

  if (collapsed) {
    return <CollapsedCell label={collapsedLabel(panel, narrative) ?? elementName} />;
  }

  if (panel) {
    return <PanelCell panel={panel} height={height} timeFrom={timeFrom} timeTo={timeTo} />;
  }

  if (narrative) {
    return <NarrativeCell content={narrative} />;
  }

  return null;
}

// A chart cell: delegates to its VizPanel, which brings its own PanelChrome (title, menu, legend).
// Cells locked to their own time range say so, since they deviate from the header's range.
function PanelCell({
  panel,
  height,
  timeFrom,
  timeTo,
}: {
  panel: VizPanel;
  height?: number;
  timeFrom?: string;
  timeTo?: string;
}) {
  const styles = useStyles2(getStyles);
  const isLocked = Boolean(timeFrom && timeTo);

  return (
    <div>
      {isLocked && (
        <div className={styles.lockRow}>
          <Icon name="lock" size="xs" />
          <Text variant="bodySmall" color="secondary">
            {t('dashboard.notebook-layout.locked-range', 'Locked: {{range}}', {
              range: formatLockedRange(timeFrom!, timeTo!),
            })}
          </Text>
        </div>
      )}
      <div className={styles.panel} style={{ height: height ?? DEFAULT_PANEL_HEIGHT }}>
        <panel.Component model={panel} />
      </div>
    </div>
  );
}

/** A human-readable label for collapsed cells (panel title or first line of text). */
function collapsedLabel(panel?: VizPanel, narrative?: CellContentKind): string | undefined {
  if (panel) {
    return panel.state.title;
  }
  if (narrative?.kind === 'Markdown') {
    return narrative.spec.text
      .split('\n')
      .map((line) => line.replace(/^[#>\-*\s`]+/, '').trim())
      .find((line) => line.length > 0);
  }
  if (narrative?.kind === 'Code') {
    return narrative.spec.language || undefined;
  }
  return undefined;
}

function formatLockedRange(from: string, to: string): string {
  if (rangeUtil.isRelativeTimeRange({ from, to })) {
    return `${from} → ${to}`;
  }
  const range = rangeUtil.convertRawToRange({ from, to });
  return `${range.from.format('MMM D, HH:mm')} → ${range.to.format('HH:mm')}`;
}

// A narrative cell: markdown or code, rendered by the component registered for its content kind.
function NarrativeCell({ content }: { content: CellContentKind }) {
  const styles = useStyles2(getStyles);

  const registered = cellTypeRegistry.getIfExists(content.kind);
  if (!registered) {
    return null;
  }

  const Renderer = registered.render;
  return (
    <div className={styles.content}>
      <Renderer content={content} />
    </div>
  );
}

// A collapsed cell: shows a compact summary, whatever the cell's type.
function CollapsedCell({ label }: { label: string }) {
  const styles = useStyles2(getStyles);

  return <div className={styles.collapsed}>{label}</div>;
}

const getStyles = (theme: GrafanaTheme2) => ({
  panel: css({
    position: 'relative',
  }),
  lockRow: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing(0.5),
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
