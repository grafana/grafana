import {
  SceneComponentProps,
  SceneCSSGridLayout,
  SceneGridLayout,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  VizPanel,
} from '@grafana/scenes';
import { Field, Input } from '@grafana/ui';

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
    throw new Error('Method not implemented.');
  }

  public addNewRow?(): void {
    throw new Error('Method not implemented.');
  }

  public removeRow?(row: SceneObject): void {
    throw new Error('Method not implemented.');
  }

  public getNextPanelId(): number {
    throw new Error('Method not implemented.');
  }

  public getLayoutId(): string {
    return 'automatic-grid-layout';
  }

  public static getDescriptor(): LayoutDescriptor {
    return {
      name: 'Automatic grid',
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
      layout: new SceneCSSGridLayout({ children }),
    });
  }
}

function CSSGridLayoutWrapperRenderer({ model }: SceneComponentProps<AutomaticGridLayoutManager>) {
  return <model.state.layout.Component model={model.state.layout} />;
}

function AutomaticGridEditor(props: LayoutEditorProps<SceneGridLayout>) {
  return (
    <>
      <Field label="Grid template">
        <Input type="text" />
      </Field>
    </>
  );
}
