import { SceneComponentProps, SceneObject, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';

import { forceRenderChildren } from '../../../utils/utils';
import { DashboardLayoutManager, LayoutDescriptor } from '../types';

import { CanvasElement } from './SceneCanvasElement';
import { SceneCanvasRootLayout } from './SceneCanvasRootLayout';
import { HorizontalConstraint, VerticalConstraint } from './canvasTypes';

interface CanvasLayoutManagerState extends SceneObjectState {
  layout: SceneCanvasRootLayout;
}

export class CanvasLayoutManager extends SceneObjectBase<CanvasLayoutManagerState> implements DashboardLayoutManager {
  public editModeChanged(isEditing: boolean): void {
    //    this.setState({ isDraggable: isEditing });
    forceRenderChildren(this, true);
  }

  public addPanel(vizPanel: VizPanel): void {
    const layout = this.state.layout;

    layout.setState({
      children: [...layout.state.children, new CanvasElement({ body: vizPanel, placement: { top: 0, left: 0 } })],
    });
  }

  public removePanel(panel: VizPanel) {}

  public getNextPanelId(): number {
    let max = 0;
    return max + 1;
  }

  public getObjects(): SceneObject[] {
    const objects: SceneObject[] = [];

    // for (const child of this.state.children) {
    //   if (child instanceof VizPanel) {
    //     objects.push(child);
    //   }
    // }

    return objects;
  }

  public getLayoutId(): string {
    return 'canvas-layout';
  }

  public getDescriptor(): LayoutDescriptor {
    return CanvasLayoutManager.getDescriptor();
  }

  public static getDescriptor(): LayoutDescriptor {
    return {
      name: 'Canvas',
      id: 'canvas-layout',
      switchTo: CanvasLayoutManager.switchTo,
    };
  }

  /**
   * Handle switching to the manual grid layout from other layouts
   * @param currentLayout
   * @returns
   */
  public static switchTo(currentLayout: DashboardLayoutManager): CanvasLayoutManager {
    const objects = currentLayout.getObjects();

    const children: CanvasElement[] = [];
    const panelHeight = 300;
    const panelWidth = 400;
    const maxWidth = 1200;

    let currentY = 0;
    let currentX = 0;

    for (let obj of objects) {
      if (obj instanceof VizPanel) {
        children.push(
          new CanvasElement({
            body: obj,
            placement: {
              top: currentX,
              left: currentY,
              width: panelWidth,
              height: panelHeight,
              vertical: VerticalConstraint.Top,
              horizontal: HorizontalConstraint.Left,
            },
          })
        );

        currentX += panelWidth;

        if (currentX + panelWidth >= maxWidth) {
          currentX = 0;
          currentY += panelHeight;
        }
      }
    }

    return new CanvasLayoutManager({ layout: new SceneCanvasRootLayout({ children }) });
  }

  public static Component = ({ model }: SceneComponentProps<CanvasLayoutManager>) => {
    const { layout } = model.useState();

    return <layout.Component model={layout} />;
  };
}
