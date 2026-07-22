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
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type NotebookLayoutItemKind, type NotebookLayoutKind } from '@grafana/schema/apis/notebook/v2beta1';
import { useStyles2 } from '@grafana/ui';

import { type PanelIdGenerator } from '../../utils/dashboardSceneGraph';
import { type DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { type LayoutRegistryItem } from '../types/LayoutRegistryItem';

import { type NotebookCellItem } from './NotebookCellItem';
import { NotebookCellRenderer } from './NotebookCellRenderer';
import { NotebookDocumentHeader } from './NotebookDocumentHeader';

interface NotebookLayoutManagerState extends SceneObjectState {
  cells: NotebookCellItem[];
  // The notebook's title and tags, shown in the document header. Held on the manager's own
  // state (set by the notebook loader) instead of read from the parent DashboardScene —
  // reaching up to the scene would import the dashboard-scene module graph and reintroduce a
  // dependency cycle.
  title?: string;
  tags?: string[];
}

export class NotebookLayoutManager
  extends SceneObjectBase<NotebookLayoutManagerState>
  implements DashboardLayoutManager
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
  public serialize(): DashboardV2Spec['layout'] {
    const cells: NotebookLayoutItemKind[] = this.state.cells.map((cell) => ({
      kind: 'NotebookLayoutItem',
      spec: {
        element: { kind: 'ElementReference', name: cell.state.elementName },
        source: cell.state.source,
        // Emit collapsed only when it was set, so an omitted value stays omitted on round-trip.
        ...(cell.state.collapsed !== undefined ? { collapsed: cell.state.collapsed } : {}),
      },
    }));

    const layout: NotebookLayoutKind = { kind: 'NotebookLayout', spec: { cells } };
    // TODO: if the layout-manager-generic RFC lands (DashboardLayoutManager made generic over its
    // serialize() return type), drop this cast and return NotebookLayoutKind directly; otherwise
    // keep it as is. The shared interface only knows the dashboard layout union, so a sibling kind
    // must be laundered through unknown here.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- notebook layout is a sibling kind not in DashboardV2Spec['layout']
    return layout as unknown as DashboardV2Spec['layout'];
  }

  // Only panel cells are viz panels; markdown/code cells are narrative content and are
  // intentionally invisible to the rest of the scene (query runner, edit tooling).
  public getVizPanels(): VizPanel[] {
    return this.state.cells.map((cell) => cell.state.body).filter((body): body is VizPanel => body !== undefined);
  }

  // Editing (add/reorder/remove) is out of scope for the POC; these satisfy the
  // DashboardLayoutManager contract minimally.
  public addPanel(): void {}

  public cloneLayout(): DashboardLayoutManager {
    return this.clone({});
  }

  public duplicate(_panelIdGenerator?: PanelIdGenerator): DashboardLayoutManager {
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
  const { cells, title, tags } = model.useState();

  const timeRange = sceneGraph.getTimeRange(model).useState();

  return (
    <div className={styles.document}>
      <header className={styles.header}>
        <NotebookDocumentHeader title={title} tags={tags} timeFrom={timeRange.from} timeTo={timeRange.to} />
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
  column: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    width: '100%',
  }),
});
