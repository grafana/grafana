import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  sceneGraph,
  SceneObjectBase,
  type SceneComponentProps,
  type SceneObject,
  type SceneObjectState,
  type VizPanel,
} from '@grafana/scenes';
import { type NotebookLayoutItemKind, type NotebookLayoutKind } from '@grafana/schema/apis/notebook/v2beta1';
import { Icon, useStyles2 } from '@grafana/ui';

import { type PanelIdGenerator } from '../../utils/dashboardSceneGraph';
import { type AnyDashboardLayoutManager, type DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { type LayoutRegistryItem } from '../types/LayoutRegistryItem';

import { type NotebookCellItem } from './NotebookCellItem';
import { NotebookCellRenderer } from './NotebookCellRenderer';

interface NotebookLayoutManagerState extends SceneObjectState {
  cells: NotebookCellItem[];
  // The notebook's tags, shown in the header. Held on the manager's own state (set by the
  // notebook loader) instead of read from the parent DashboardScene — reaching up to the scene
  // would import the dashboard-scene module graph and reintroduce a dependency cycle.
  tags?: string[];
}

export class NotebookLayoutManager
  extends SceneObjectBase<NotebookLayoutManagerState>
  implements DashboardLayoutManager<{}, NotebookLayoutKind>
{
  public static Component = NotebookLayoutManagerRenderer;
  public readonly isDashboardLayoutManager = true;

  public static readonly descriptor: LayoutRegistryItem = {
    get name() {
      return t('dashboard.notebook-layout.name', 'Notebook');
    },
    get description() {
      return t('dashboard.notebook-layout.description', 'A vertical sequence of panels, text, and code cells');
    },
    id: 'NotebookLayout',
    createFromLayout: NotebookLayoutManager.createFromLayout,
    isGridLayout: false,
    icon: 'list-ul',
  };

  public readonly descriptor = NotebookLayoutManager.descriptor;

  // Serialization lives here (not in a standalone helper) so the manager doesn't import the
  // serializer module — that mutual import is what forms a dependency cycle. The serializer
  // still imports this manager to construct it in deserialize, which stays one-directional.
  public serialize(): NotebookLayoutKind {
    const cells: NotebookLayoutItemKind[] = this.state.cells.map((cell) => ({
      kind: 'NotebookLayoutItem',
      spec: {
        element: { kind: 'ElementReference', name: cell.state.elementName },
        source: cell.state.source,
        // Emit collapsed only when it was set, so an omitted value stays omitted on round-trip.
        ...(cell.state.collapsed !== undefined ? { collapsed: cell.state.collapsed } : {}),
      },
    }));

    return { kind: 'NotebookLayout', spec: { cells } };
  }

  // Only panel cells are viz panels; markdown/code cells are narrative content and are
  // intentionally invisible to the rest of the scene (query runner, edit tooling).
  public getVizPanels(): VizPanel[] {
    return this.state.cells.map((cell) => cell.state.body).filter((body): body is VizPanel => body !== undefined);
  }

  // Editing (add/reorder/remove) is out of scope for the POC; these satisfy the
  // DashboardLayoutManager contract minimally.
  public addPanel(): void {}

  public cloneLayout(): AnyDashboardLayoutManager {
    return this.clone({});
  }

  public duplicate(_panelIdGenerator?: PanelIdGenerator): AnyDashboardLayoutManager {
    return this.clone({ key: undefined });
  }

  public getOutlineChildren(): SceneObject[] {
    return [];
  }

  public getAllGridTypes(): string[] {
    return [];
  }

  public static createFromLayout(): NotebookLayoutManager {
    return new NotebookLayoutManager({ cells: [] });
  }
}

function NotebookLayoutManagerRenderer({ model }: SceneComponentProps<NotebookLayoutManager>) {
  const styles = useStyles2(getStyles);
  const { cells, tags } = model.useState();

  const timeRange = sceneGraph.getTimeRange(model).useState();

  // The notebook title is shown by the app chrome (page breadcrumb), so the in-document
  // header carries only the Notebook pill, scope and tags to avoid duplicating it.
  return (
    <div className={styles.document}>
      <header className={styles.header}>
        <span className={styles.pill}>
          <Icon name="book" size="sm" />
          {t('dashboard.notebook-layout.pill', 'Notebook')}
        </span>
        <div className={styles.meta}>
          {t('dashboard.notebook-layout.scope', 'Scope')}: {timeRange.from} → {timeRange.to}
          {tags && tags.length > 0 ? ` · ${tags.join(', ')}` : ''}
        </div>
      </header>

      <div className={styles.column}>
        {cells.map((cell) => (
          <NotebookCellRenderer cell={cell} key={cell.state.key} />
        ))}
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  document: css({
    maxWidth: 900,
    margin: '0 auto',
    padding: theme.spacing(3, 3, 6, 3),
    width: '100%',
  }),
  header: css({
    marginBottom: theme.spacing(3),
    paddingBottom: theme.spacing(2),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  pill: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.25, 1),
    marginBottom: theme.spacing(1),
    borderRadius: theme.shape.radius.pill,
    border: `1px solid ${theme.colors.primary.border}`,
    color: theme.colors.primary.text,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
  }),
  meta: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  column: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    width: '100%',
  }),
});
