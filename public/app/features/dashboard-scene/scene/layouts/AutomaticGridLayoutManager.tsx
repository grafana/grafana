import { SelectableValue, toOption } from '@grafana/data';
import {
  SceneComponentProps,
  SceneCSSGridLayout,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  VizPanel,
} from '@grafana/scenes';
import { Button, Field, Select } from '@grafana/ui';

import { DashboardInteractions } from '../../utils/interactions';
import { getDefaultVizPanel, getPanelIdForVizPanel } from '../../utils/utils';

import { LayoutEditChrome } from './LayoutEditChrome';
import { DashboardLayoutManager, LayoutRegistryItem, LayoutEditorProps, LayoutElementInfo } from './types';

interface AutomaticGridLayoutManagerState extends SceneObjectState {
  layout: SceneCSSGridLayout;
}

export class AutomaticGridLayoutManager
  extends SceneObjectBase<AutomaticGridLayoutManagerState>
  implements DashboardLayoutManager
{
  public editModeChanged(isEditing: boolean): void {}

  public cleanUpStateFromExplore(): void {}

  public addNewPanel(): void {
    const vizPanel = getDefaultVizPanel(this.getNextPanelId());

    this.state.layout.setState({
      children: [...this.state.layout.state.children, vizPanel],
    });
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

  public getLayoutId(): string {
    return 'automatic-grid-layout';
  }

  public getDescriptor(): LayoutRegistryItem {
    return AutomaticGridLayoutManager.getDescriptor();
  }

  public renderEditor() {
    return <AutomaticGridEditor layoutManager={this} />;
  }

  public static getDescriptor(): LayoutRegistryItem {
    return {
      name: 'Responsive grid',
      id: 'automatic-grid-layout',
      create: () => new AutomaticGridLayoutManager({ layout: new SceneCSSGridLayout({ children: [] }) }),
    };
  }

  public getElements(): LayoutElementInfo[] {
    const elements: LayoutElementInfo[] = [];

    for (const child of this.state.layout.state.children) {
      if (child instanceof VizPanel) {
        elements.push({ body: child });
      }
    }

    return elements;
  }

  public initFromLayout(layout: DashboardLayoutManager): AutomaticGridLayoutManager {
    const elements = layout.getElements();
    const children: SceneObject[] = [];

    for (let element of elements) {
      if (element.body instanceof VizPanel) {
        children.push(element.body.clone());
      }
    }

    return new AutomaticGridLayoutManager({
      layout: new SceneCSSGridLayout({
        children,
        templateColumns: 'repeat(auto-fit, minmax(400px, auto))',
        autoRows: 'minmax(400px, auto)',
      }),
    });
  }

  public static Component = ({ model }: SceneComponentProps<AutomaticGridLayoutManager>) => {
    return (
      <LayoutEditChrome layoutManager={model}>
        <model.state.layout.Component model={model.state.layout} />;
      </LayoutEditChrome>
    );
  };
}

function AutomaticGridEditor({ layoutManager }: LayoutEditorProps<AutomaticGridLayoutManager>) {
  const cssLayout = layoutManager.state.layout;
  const { templateColumns, autoRows } = cssLayout.useState();
  const widthParams = parseMinMaxParameters(templateColumns);
  const heightParams = parseMinMaxParameters(autoRows);

  const minOptions = ['100px', '200px', '300px', '400px', '500px', '600px'].map(toOption);
  const maxOptions = [{ label: 'Auto', value: 'auto' }, ...minOptions];

  const onMinWidthChange = (value: SelectableValue<string>) => {
    cssLayout.setState({ templateColumns: `repeat(auto-fit, minmax(${value.value}, ${widthParams.max}))` });
  };

  const onMaxWidthChange = (value: SelectableValue<string>) => {
    cssLayout.setState({ templateColumns: `repeat(auto-fit, minmax(${widthParams.min}, ${value.value}))` });
  };

  const onMinHeightChange = (value: SelectableValue<string>) => {
    cssLayout.setState({ autoRows: `minmax(${value.value},  ${heightParams.max})` });
  };

  const onMaxHeightChange = (value: SelectableValue<string>) => {
    cssLayout.setState({ autoRows: `minmax(${heightParams.min}, ${value.value})` });
  };

  return (
    <>
      {widthParams.min && (
        <Field label="Min width">
          <Select options={minOptions} value={widthParams.min} onChange={onMinWidthChange} />
        </Field>
      )}
      {widthParams.max && (
        <Field label="Max width">
          <Select options={maxOptions} value={widthParams.max} onChange={onMaxWidthChange} />
        </Field>
      )}
      {heightParams.min && (
        <Field label="Min hight">
          <Select options={minOptions} value={heightParams.min} onChange={onMinHeightChange} />
        </Field>
      )}
      {heightParams.max && (
        <Field label="Max hight">
          <Select options={maxOptions} value={heightParams.max} onChange={onMaxHeightChange} />
        </Field>
      )}
      <Button
        fill="outline"
        icon="plus"
        onClick={() => {
          layoutManager.addNewPanel();
          DashboardInteractions.toolbarAddButtonClicked({ item: 'add_visualization' });
          // dashboard.setState({ editPanel: buildPanelEditScene(vizPanel, true) });
        }}
      >
        Panel
      </Button>
    </>
  );
}

function parseMinMaxParameters(input: string | number | undefined): { min: string | null; max: string | null } {
  if (typeof input !== 'string') {
    return { min: null, max: null };
  }

  // Regular expression to match the minmax function and its parameters
  const minmaxRegex = /minmax\(([^,]+),\s*([^\)]+)\)/;

  // Execute the regex on the input string
  const match = input.match(minmaxRegex);

  // If a match is found, return the min and max parameters
  if (match) {
    const min = match[1].trim(); // First parameter to minmax
    const max = match[2].trim(); // Second parameter to minmax
    return { min, max };
  }

  // If no match is found, return null values
  return { min: null, max: null };
}
