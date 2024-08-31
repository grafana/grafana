import {
  SceneComponentProps,
  SceneLayout,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  VizPanel,
} from '@grafana/scenes';
import { GRID_COLUMN_COUNT } from 'app/core/constants';

import { forceRenderChildren, getPanelIdForVizPanel } from '../../utils/utils';
import { DashboardGridItem } from '../DashboardGridItem';

import { DashboardLayoutManager, LayoutDescriptor } from './types';

interface CanvasLayoutManagerState extends SceneObjectState {
  children: CanvasElement[];
  isDraggable: boolean;
}

export class CanvasLayoutManager
  extends SceneObjectBase<CanvasLayoutManagerState>
  implements DashboardLayoutManager, SceneLayout
{
  public editModeChanged(isEditing: boolean): void {
    this.setState({ isDraggable: isEditing });
    forceRenderChildren(this, true);
  }

  public addPanel(vizPanel: VizPanel): void {
    this.setState({
      children: [...this.state.children, new CanvasElement({ body: vizPanel, width: 300, height: 300, x: 0, y: 0 })],
    });
  }

  public removePanel(panel: VizPanel) {}

  public getNextPanelId(): number {
    let max = 0;
    return max + 1;
  }

  public getObjects(): SceneObject[] {
    const objects: SceneObject[] = [];

    for (const child of this.state.children) {
      if (child instanceof VizPanel) {
        objects.push(child);
      }
    }

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
            x: currentX,
            y: currentY,
            width: panelWidth,
            height: panelHeight,
            body: obj,
          })
        );

        currentX += panelWidth;

        if (currentX + panelWidth >= maxWidth) {
          currentX = 0;
          currentY += panelHeight;
        }
      }
    }

    return new CanvasLayoutManager({ children, isDraggable: true });
  }

  public isDraggable() {
    return this.state.isDraggable;
  }

  public getDragClass(): string {
    return 'canvas-element-drag';
  }

  public getDragClassCancel(): string {
    return 'canvas-element-drag-cancel';
  }

  public static Component = ({ model }: SceneComponentProps<CanvasLayoutManager>) => {
    const { children } = model.useState();

    return (
      <div style={{ flexGrow: 1, minHeight: 0, position: 'relative' }}>
        {children.map((child, index) => (
          <CanvasElement.Component key={child.state.key} model={child} />
        ))}
      </div>
    );
  };
}

interface CanvasElementState extends SceneObjectState {
  body: VizPanel;
  width: number;
  height: number;
  x: number;
  y: number;
}

export class CanvasElement extends SceneObjectBase<CanvasElementState> {
  public static Component = ({ model }: SceneComponentProps<CanvasElement>) => {
    const { width, height, x, y, body } = model.useState();

    return (
      <div style={{ width, height, top: y, left: x, position: 'absolute' }}>
        <body.Component model={body} />
      </div>
    );
  };
}
