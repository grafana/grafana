import { SelectableValue, toOption } from '@grafana/data';
import {
  SceneComponentProps,
  SceneCSSGridLayout,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  VizPanel,
} from '@grafana/scenes';
import { Field, Select } from '@grafana/ui';

import { getPanelIdForVizPanel } from '../../utils/utils';

import { DashboardLayoutManager, LayoutDescriptor, LayoutEditorProps } from './types';

interface AutomaticGridLayoutManagerState extends SceneObjectState {
  layout: SceneCSSGridLayout;
}

export class AutomaticGridLayoutManager
  extends SceneObjectBase<AutomaticGridLayoutManagerState>
  implements DashboardLayoutManager
{
  static Component = CSSGridLayoutWrapperRenderer;

  public editModeChanged(isEditing: boolean): void {}

  public cleanUpStateFromExplore(): void {}

  public addPanel(vizPanel: VizPanel): void {
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

  public getDescriptor(): LayoutDescriptor {
    return AutomaticGridLayoutManager.getDescriptor();
  }

  public renderEditor() {
    return <AutomaticGridEditor layoutManager={this} />;
  }

  public static getDescriptor(): LayoutDescriptor {
    return {
      name: 'Responsive grid',
      id: 'automatic-grid-layout',
      switchTo: AutomaticGridLayoutManager.switchTo,
    };
  }

  public getObjects(): SceneObject[] {
    const objects: SceneObject[] = [];

    for (const child of this.state.layout.state.children) {
      if (child instanceof VizPanel) {
        objects.push(child);
      }
    }

    return objects;
  }

  public static switchTo(currentLayout: DashboardLayoutManager): AutomaticGridLayoutManager {
    const objects = currentLayout.getObjects();
    const children: SceneObject[] = [];

    for (let obj of objects) {
      if (obj instanceof VizPanel) {
        children.push(obj.clone());
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
}

function CSSGridLayoutWrapperRenderer({ model }: SceneComponentProps<AutomaticGridLayoutManager>) {
  return <model.state.layout.Component model={model.state.layout} />;
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
