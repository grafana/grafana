import { SelectableValue } from '@grafana/data';
import { SceneComponentProps, SceneCSSGridLayout, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';
import { Button, Field, Select } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { DashboardInteractions } from '../../utils/interactions';
import { getDefaultVizPanel, getPanelIdForVizPanel, getVizPanelKeyForPanelId } from '../../utils/utils';
import { LayoutEditChrome } from '../layouts-shared/LayoutEditChrome';
import { DashboardLayoutManager, LayoutRegistryItem, LayoutEditorProps } from '../types';

import { ResponsiveGridItem } from './ResponsiveGridItem';

interface ResponsiveGridLayoutManagerState extends SceneObjectState {
  layout: SceneCSSGridLayout;
}

export class ResponsiveGridLayoutManager
  extends SceneObjectBase<ResponsiveGridLayoutManagerState>
  implements DashboardLayoutManager
{
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

  public renderEditor() {
    return <AutomaticGridEditor layoutManager={this} />;
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
    return new ResponsiveGridLayoutManager({ layout: new SceneCSSGridLayout({ children: [] }) });
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

  public static Component = ({ model }: SceneComponentProps<ResponsiveGridLayoutManager>) => {
    return (
      <LayoutEditChrome layoutManager={model}>
        <model.state.layout.Component model={model.state.layout} />
      </LayoutEditChrome>
    );
  };
}

function AutomaticGridEditor({ layoutManager }: LayoutEditorProps<ResponsiveGridLayoutManager>) {
  const cssLayout = layoutManager.state.layout;
  const { templateColumns, autoRows } = cssLayout.useState();

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

  const onColumnsChange = (value: SelectableValue<string>) => {
    cssLayout.setState({ templateColumns: value.value });
  };

  const onRowsChange = (value: SelectableValue<string>) => {
    cssLayout.setState({ autoRows: value.value });
  };

  return (
    <>
      <Field label="Columns">
        <Select
          options={colOptions}
          value={String(templateColumns)}
          onChange={onColumnsChange}
          allowCustomValue={true}
        />
      </Field>

      <Field label="Row height">
        <Select options={rowOptions} value={String(autoRows)} onChange={onRowsChange} />
      </Field>
      <Button
        fill="outline"
        icon="plus"
        onClick={() => {
          const vizPanel = getDefaultVizPanel();
          layoutManager.addPanel(vizPanel);
          DashboardInteractions.toolbarAddButtonClicked({ item: 'add_visualization' });
        }}
      >
        <Trans i18nKey="dashboard.add-menu.visualization">Visualization</Trans>
      </Button>
    </>
  );
}
