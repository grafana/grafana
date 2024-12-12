import { SelectableValue } from '@grafana/data';
import { SceneComponentProps, SceneCSSGridLayout, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';
import { Select } from '@grafana/ui';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { getPanelIdForVizPanel, getVizPanelKeyForPanelId } from '../../utils/utils';
import { DashboardLayoutManager, LayoutRegistryItem } from '../types';

import { ResponsiveGridItem } from './ResponsiveGridItem';

interface ResponsiveGridLayoutManagerState extends SceneObjectState {
  layout: SceneCSSGridLayout;
}

export class ResponsiveGridLayoutManager
  extends SceneObjectBase<ResponsiveGridLayoutManagerState>
  implements DashboardLayoutManager
{
  public isDashboardLayoutManager: true = true;

  public editModeChanged(isEditing: boolean): void {}

  public addPanel(vizPanel: VizPanel): void {
    const panelId = this.getNextPanelId();

    vizPanel.setState({ key: getVizPanelKeyForPanelId(panelId) });
    vizPanel.clearParent();

    this.state.layout.setState({
      children: [new ResponsiveGridItem({ body: vizPanel }), ...this.state.layout.state.children],
    });
  }

  public addNewRow(): void {
    throw new Error('Method not implemented.');
  }

  public getNextPanelId(): number {
    let max = 0;

    for (const child of this.state.layout.state.children) {
      if (child instanceof VizPanel) {
        let panelId = getPanelIdForVizPanel(child);

        if (panelId > max) {
          max = panelId;
        }
      }
    }

    return max;
  }

  public removePanel(panel: VizPanel) {
    const element = panel.parent;
    this.state.layout.setState({ children: this.state.layout.state.children.filter((child) => child !== element) });
  }

  public duplicatePanel(panel: VizPanel): void {
    throw new Error('Method not implemented.');
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

  public getDescriptor(): LayoutRegistryItem {
    return ResponsiveGridLayoutManager.getDescriptor();
  }

  public static getDescriptor(): LayoutRegistryItem {
    return {
      name: 'Responsive grid',
      description: 'CSS layout that adjusts to the available space',
      id: 'responsive-grid',
      createFromLayout: ResponsiveGridLayoutManager.createFromLayout,
    };
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

  toSaveModel?() {
    throw new Error('Method not implemented.');
  }

  activateRepeaters?(): void {
    throw new Error('Method not implemented.');
  }
  public static Component = ({ model }: SceneComponentProps<ResponsiveGridLayoutManager>) => {
    return <model.state.layout.Component model={model.state.layout} />;
  };
}

function getOptions(layoutManager: ResponsiveGridLayoutManager): OptionsPaneItemDescriptor[] {
  const options: OptionsPaneItemDescriptor[] = [];

  const cssLayout = layoutManager.state.layout;

  const rowOptions: Array<SelectableValue<string>> = [];
  const sizes = [100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 650];
  const colOptions: Array<SelectableValue<string>> = [
    { label: `1 column`, value: `1fr` },
    { label: `2 columns`, value: `1fr 1fr` },
    { label: `3 columns`, value: `1fr 1fr 1fr` },
  ];

  for (const size of sizes) {
    colOptions.push({ label: `Min: ${size}px`, value: `repeat(auto-fit, minmax(${size}px, auto))` });
  }

  for (const size of sizes) {
    rowOptions.push({ label: `Min: ${size}px`, value: `minmax(${size}px, auto)` });
  }

  for (const size of sizes) {
    rowOptions.push({ label: `Fixed: ${size}px`, value: `${size}px` });
  }

  options.push(
    new OptionsPaneItemDescriptor({
      title: 'Columns',
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
      title: 'Rows',
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
