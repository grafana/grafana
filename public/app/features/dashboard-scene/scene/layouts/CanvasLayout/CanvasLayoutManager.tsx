import { SceneComponentProps, SceneObject, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';
import { Button } from '@grafana/ui';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';

import { forceRenderChildren, getDefaultVizPanel } from '../../../utils/utils';
import { LayoutEditChrome } from '../LayoutEditChrome';
import {
  DashboardLayoutManager,
  LayoutRegistryItem,
  LayoutEditorProps,
  LayoutElementInfo,
  DashboardLayoutElement,
} from '../types';

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

  public addNewPanel(): void {
    const vizPanel = getDefaultVizPanel(this.getNextPanelId());
    const layout = this.state.layout;

    layout.setState({
      children: [
        ...layout.state.children,
        new CanvasElement({ body: vizPanel, placement: { top: 0, left: 0, width: 400, height: 300 } }),
      ],
    });

    return vizPanel;
  }

  public getNextPanelId(): number {
    let max = 0;
    return max + 1;
  }

  public removeElement(element: DashboardLayoutElement) {
    this.state.layout.setState({ children: this.state.layout.state.children.filter((child) => child !== element) });
  }

  public getElements(): LayoutElementInfo[] {
    const objects: LayoutElementInfo[] = [];

    for (const child of this.state.layout.state.children) {
      if (child.state.body instanceof VizPanel) {
        objects.push({ body: child.state.body });
      }
    }

    return objects;
  }

  public getDescriptor(): LayoutRegistryItem {
    return CanvasLayoutManager.getDescriptor();
  }

  public renderEditor(): React.ReactNode {
    return <CanvasLayoutEditor layoutManager={this} />;
  }

  public static getDescriptor(): LayoutRegistryItem {
    return {
      name: 'Canvas',
      description: 'Place panels and elements anywhere on a canvas',
      id: 'canvas-layout',
      createFromLayout: CanvasLayoutManager.createFromLayout,
    };
  }

  /**
   * Handle switching to the manual grid layout from other layouts
   * @param currentLayout
   * @returns
   */
  public static createFromLayout(layout: DashboardLayoutManager): CanvasLayoutManager {
    const elements = layout.getElements();
    const children: CanvasElement[] = [];
    const panelHeight = 300;
    const panelWidth = 400;
    const maxWidth = 1200;

    let currentY = 0;
    let currentX = 0;

    for (let element of elements) {
      if (element.body instanceof VizPanel) {
        children.push(
          new CanvasElement({
            body: element.body,
            placement: {
              top: currentY,
              left: currentX,
              width: panelWidth,
              height: panelHeight,
              vertical: VerticalConstraint.Top,
              horizontal: HorizontalConstraint.Left,
            },
          })
        );

        currentX += panelWidth + 8;

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

    return (
      <LayoutEditChrome layoutManager={model}>
        <layout.Component model={layout} />;
      </LayoutEditChrome>
    );
  };
}

function CanvasLayoutEditor({ layoutManager }: LayoutEditorProps<CanvasLayoutManager>) {
  return (
    <>
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
      <Button
        fill="outline"
        icon="plus"
        onClick={() => {
          layoutManager.addNewPanel();
          DashboardInteractions.toolbarAddButtonClicked({ item: 'add_visualization' });
          // dashboard.setState({ editPanel: buildPanelEditScene(vizPanel, true) });
        }}
      >
        Element
      </Button>
    </>
  );
}
