import { SelectableValue } from '@grafana/data';
import {
  SceneComponentProps,
  SceneCSSGridLayout,
  SceneObjectBase,
  SceneObjectState,
  useSceneObjectState,
  VizPanel,
} from '@grafana/scenes';
import { Select } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import DashboardEmpty from 'app/features/dashboard/dashgrid/DashboardEmpty';

import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import { getDashboardSceneFor, getGridItemKeyForPanelId, getVizPanelKeyForPanelId } from '../../utils/utils';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { DashboardLayoutManager } from '../types/DashboardLayoutManager';

import { ResponsiveGridItem } from './ResponsiveGridItem';

interface ResponsiveGridLayoutManagerState extends SceneObjectState {
  layout: SceneCSSGridLayout;
}

export class ResponsiveGridLayoutManager
  extends SceneObjectBase<ResponsiveGridLayoutManagerState>
  implements DashboardLayoutManager
{
  public readonly isDashboardLayoutManager = true;

  public static readonly descriptor = {
    get name() {
      return t('dashboard.responsive-layout.name', 'Responsive grid');
    },
    get description() {
      return t('dashboard.responsive-layout.description', 'CSS layout that adjusts to the available space');
    },
    id: 'responsive-grid',
    createFromLayout: ResponsiveGridLayoutManager.createFromLayout,
  };

  public readonly descriptor = ResponsiveGridLayoutManager.descriptor;

  public constructor(state: ResponsiveGridLayoutManagerState) {
    super(state);

    //@ts-ignore
    this.state.layout.getDragClassCancel = () => 'drag-cancel';
  }

  public editModeChanged(isEditing: boolean): void {}

  public addPanel(vizPanel: VizPanel): void {
    const panelId = dashboardSceneGraph.getNextPanelId(this);

    vizPanel.setState({ key: getVizPanelKeyForPanelId(panelId) });
    vizPanel.clearParent();

    this.state.layout.setState({
      children: [new ResponsiveGridItem({ body: vizPanel }), ...this.state.layout.state.children],
    });
  }

  public addNewRow(): void {
    const rowsLayout = RowsLayoutManager.createFromLayout(this);
    rowsLayout.addNewRow();
    getDashboardSceneFor(this).switchLayout(rowsLayout);
  }

  public removePanel(panel: VizPanel) {
    const element = panel.parent;
    this.state.layout.setState({ children: this.state.layout.state.children.filter((child) => child !== element) });
  }

  public duplicatePanel(panel: VizPanel): void {
    const gridItem = panel.parent;
    if (!(gridItem instanceof ResponsiveGridItem)) {
      console.error('Trying to duplicate a panel that is not inside a DashboardGridItem');
      return;
    }

    const newPanelId = dashboardSceneGraph.getNextPanelId(this);
    const grid = this.state.layout;

    const newGridItem = gridItem.clone({
      key: getGridItemKeyForPanelId(newPanelId),
      body: panel.clone({
        key: getVizPanelKeyForPanelId(newPanelId),
      }),
    });

    const sourceIndex = grid.state.children.indexOf(gridItem);
    const newChildren = [...grid.state.children];

    // insert after
    newChildren.splice(sourceIndex + 1, 0, newGridItem);

    grid.setState({ children: newChildren });
  }

  public getVizPanels(): VizPanel[] {
    const panels: VizPanel[] = [];

    for (const child of this.state.layout.state.children) {
      if (child instanceof ResponsiveGridItem) {
        panels.push(child.state.body);
      }
    }

    return panels;
  }

  public getOptions(): OptionsPaneItemDescriptor[] {
    return getOptions(this);
  }

  public static createEmpty() {
    return new ResponsiveGridLayoutManager({
      layout: new SceneCSSGridLayout({
        children: [],
        templateColumns: 'repeat(auto-fit, minmax(400px, auto))',
        autoRows: 'minmax(300px, auto)',
      }),
    });
  }

  public static createFromLayout(layout: DashboardLayoutManager): ResponsiveGridLayoutManager {
    const panels = layout.getVizPanels();
    const children: ResponsiveGridItem[] = [];

    for (let panel of panels) {
      children.push(new ResponsiveGridItem({ body: panel.clone() }));
    }

    return new ResponsiveGridLayoutManager({
      layout: new SceneCSSGridLayout({
        children,
        templateColumns: 'repeat(auto-fit, minmax(400px, auto))',
        autoRows: 'minmax(300px, auto)',
      }),
    });
  }

  /**
   * Might as well implement this as a no-top function as vs-code very eagerly adds optional functions that throw Method not implemented
   */
  public activateRepeaters(): void {}

  public static Component = ({ model }: SceneComponentProps<ResponsiveGridLayoutManager>) => {
    const { children } = useSceneObjectState(model.state.layout, { shouldActivateOrKeepAlive: true });
    const dashboard = getDashboardSceneFor(model);

    // If we are top level layout and have no children, show empty state
    if (model.parent === dashboard && children.length === 0) {
      return (
        <DashboardEmpty dashboard={dashboard} canCreate={!!dashboard.state.meta.canEdit} key="dashboard-empty-state" />
      );
    }

    return <model.state.layout.Component model={model.state.layout} />;
  };
}

function getOptions(layoutManager: ResponsiveGridLayoutManager): OptionsPaneItemDescriptor[] {
  const options: OptionsPaneItemDescriptor[] = [];

  const cssLayout = layoutManager.state.layout;

  const rowOptions: Array<SelectableValue<string>> = [];
  const sizes = [100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 650];
  const colOptions: Array<SelectableValue<string>> = [
    { label: t('dashboard.responsive-layout.options.one-column', '1 column'), value: `1fr` },
    { label: t('dashboard.responsive-layout.options.two-columns', '2 columns'), value: `1fr 1fr` },
    { label: t('dashboard.responsive-layout.options.three-columns', '3 columns'), value: `1fr 1fr 1fr` },
  ];

  for (const size of sizes) {
    colOptions.push({
      label: t('dashboard.responsive-layout.options.min', 'Min: {{size}}px', { size }),
      value: `repeat(auto-fit, minmax(${size}px, auto))`,
    });
  }

  for (const size of sizes) {
    rowOptions.push({
      label: t('dashboard.responsive-layout.options.min', 'Min: {{size}}px', { size }),
      value: `minmax(${size}px, auto)`,
    });
  }

  for (const size of sizes) {
    rowOptions.push({
      label: t('dashboard.responsive-layout.options.fixed', 'Fixed: {{size}}px', { size }),
      value: `${size}px`,
    });
  }

  options.push(
    new OptionsPaneItemDescriptor({
      title: t('dashboard.responsive-layout.options.columns', 'Columns'),
      render: () => {
        const { templateColumns } = cssLayout.useState();
        return (
          <Select
            options={colOptions}
            value={String(templateColumns)}
            onChange={(value) => {
              cssLayout.setState({ templateColumns: value.value });
            }}
            allowCustomValue={true}
          />
        );
      },
    })
  );

  options.push(
    new OptionsPaneItemDescriptor({
      title: t('dashboard.responsive-layout.options.rows', 'Rows'),
      render: () => {
        const { autoRows } = cssLayout.useState();
        return (
          <Select
            options={rowOptions}
            value={String(autoRows)}
            onChange={(value) => {
              cssLayout.setState({ autoRows: value.value });
            }}
            allowCustomValue={true}
          />
        );
      },
    })
  );

  return options;
}
