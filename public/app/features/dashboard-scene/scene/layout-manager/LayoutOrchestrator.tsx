import { createRef } from 'react';

import {
  SceneObjectState,
  SceneLayout,
  SceneObject,
  SceneObjectBase,
  SceneObjectRef,
  sceneGraph,
  VizPanel,
  SceneComponentProps,
} from '@grafana/scenes';
import { Portal } from '@grafana/ui';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { DropZonePlaceholder } from '../layout-default/DropZonePlaceholder';
import { FloatingPanel } from '../layout-default/FloatingPanel';
import { isDashboardLayoutItem } from '../types/DashboardLayoutItem';
import { DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { LayoutRegistryItem } from '../types/LayoutRegistryItem';

import { DropZone } from './DragManager';
import { closestCell, getClosest, isSceneLayout, SceneLayout2 } from './utils';

interface LayoutOrchestratorState extends SceneObjectState {
  manager: DashboardLayoutManager;
  activeLayoutRef?: SceneObjectRef<SceneLayout>;
  activeItemRef?: SceneObjectRef<SceneObject>;
  activeItemDimensions?: {
    width: number;
    height: number;
    left: number;
    top: number;
  };
  dropZone?: DropZone;
  placeholder?: {
    width: number;
    height: number;
    left: number;
    top: number;
  };
}

export class LayoutOrchestrator extends SceneObjectBase<LayoutOrchestratorState> implements DashboardLayoutManager {
  public isDashboardLayoutManager: true = true;
  /** The layout the the panel being dragged came from */
  private originLayout: SceneLayout2 | undefined;

  /** Rectangles representing places the dragged panel can be placed */
  public dropZones: DropZone[] = [];
  public floatingPanelRef = createRef<HTMLDivElement>();
  public placeholderRef = createRef<HTMLDivElement>();
  public descriptor: Readonly<LayoutRegistryItem<{}>> = this.state.manager.descriptor;

  hasVizPanels(): boolean {
    return true;
  }

  addNewTab(): void {
    return;
  }

  public onDragStart = (e: PointerEvent, layout: SceneLayout2, item: SceneObject) => {
    const layoutItem = getClosest(item, (o) => (isDashboardLayoutItem(o) ? o : undefined));

    this.originLayout = layout;

    document.addEventListener('pointermove', this.onDrag);
    document.addEventListener('pointerup', this.onDragEnd);
    document.body.classList.add('dragging-active');
    if (this.floatingPanelRef.current) {
      this.floatingPanelRef.current.style.visibility = 'visible';
    }

    const dropZones = [];
    // get dropzones from drag-enabled layouts
    const layouts = sceneGraph.findAllObjects(this.getRoot(), isSceneLayout) as SceneLayout2[];
    for (const l of layouts) {
      dropZones.push(...l.getDropZones().map((v) => ({ ...v, layoutKey: l.state.key! })));
    }
    this.dropZones = dropZones;
    const { closest, offset } = closestCell(this, this.dropZones, { x: e.clientX, y: e.clientY });

    this.setState({
      placeholder: {
        width: closest.right - closest.left,
        height: closest.bottom - closest.top,
        top: offset.y,
        left: offset.x,
      },
      activeItemRef: layoutItem?.getRef(),
      dropZone: closest,
      activeItemDimensions: {
        width: closest.right - closest.left,
        height: closest.bottom - closest.top,
        left: offset.x,
        top: offset.y,
      },
    });

    // measure and store height of all scroll zones
  };

  private movePlaceholder = (dropZone: DropZone, scrollTop: number) => {
    if (this.placeholderRef.current) {
      if (this.placeholderRef.current.style.width === '1px' && this.placeholderRef.current.style.height === '1px') {
        // This is a newly created placeholder, don't animate it.
        this.placeholderRef.current.style.transition = 'translate 0ms, width 0ms, height 0ms';
      } else {
        this.placeholderRef.current.style.transition = 'translate 150ms ease, width 150ms ease, height 150ms ease';
      }
      this.placeholderRef.current.style.width = `${dropZone.right - dropZone.left}px`;
      this.placeholderRef.current.style.height = `${dropZone.bottom - dropZone.top}px`;
      this.placeholderRef.current.style.translate = `${dropZone.left}px ${dropZone.top - scrollTop}px`;
    }
  };

  public onDrag = (e: PointerEvent) => {
    const activeLayout = this.state.activeLayoutRef?.resolve();
    if (!activeLayout) {
      return;
    }

    const localDropZones = this.dropZones.filter((v) => v.layoutKey === activeLayout.state.key);
    if (localDropZones.length === 0) {
      // For the first tick after switching layouts, the dropzones are not yet been updated.
      // This shouldn't be a problem, this event will trigger again and eventually the
      // dropzones will be there.
      return;
    }
    let cell = closestCell(this, localDropZones, { x: e.clientX, y: e.clientY });
    let state: Partial<LayoutOrchestratorState> = {};

    if (
      !this.state.dropZone ||
      this.state.dropZone.layoutKey !== cell.closest.layoutKey ||
      this.state.dropZone.order !== cell.closest.order
    ) {
      // new layout item entered
      state.dropZone = cell.closest;
      state.placeholder = {
        width: state.dropZone.right - state.dropZone.left,
        height: state.dropZone.bottom - state.dropZone.top,
        left: state.dropZone.left,
        top: state.dropZone.top - cell.scrollTop,
      };

      this.movePlaceholder(state.dropZone, cell.scrollTop);
    } else {
      this.movePlaceholder(this.state.dropZone, cell.scrollTop);
    }

    if (Object.keys(state).length > 0) {
      this.setState(state);
    }

    // set transform on layout item we're dragging.
    if (this.floatingPanelRef.current) {
      this.floatingPanelRef.current.style.transform = `translate(${e.clientX}px,${e.clientY}px)`;
    }
  };

  public onDragEnd = (e: PointerEvent) => {
    document.removeEventListener('pointermove', this.onDrag);
    document.removeEventListener('pointerup', this.onDragEnd);

    document.body.releasePointerCapture(e.pointerId);
    const activeLayout = this.state.activeLayoutRef?.resolve();
    const activeItem = this.state.activeItemRef?.resolve();
    if (!activeLayout || !activeItem) {
      return;
    }

    if (this.originLayout === activeLayout && this.originLayout) {
      const kids = [...activeLayout.state.children];
      const oldIndex = kids.indexOf(activeItem);
      const childToMove = kids.splice(oldIndex, 1)[0];
      kids.splice(this.state.dropZone!.order, 0, childToMove);
      childToMove.clearParent();
      this.originLayout?.setState({
        children: kids,
      });
    } else if (this.originLayout !== this.state.activeLayoutRef && this.state.activeLayoutRef) {
      this.originLayout?.setState({
        children: this.originLayout.state.children.filter((v) => v !== activeItem),
      });
      const kids = [...activeLayout.state.children];
      kids.splice(this.state.dropZone!.order, 0, activeItem);
      activeItem.clearParent();
      activeLayout.setState({
        children: kids,
      });
    }

    this.setState({ activeItemRef: undefined, dropZone: undefined });
    if (this.floatingPanelRef.current) {
      this.floatingPanelRef.current.style.visibility = '';
    }
    document.body.classList.remove('dragging-active');
  };

  public refreshDropZones() {
    const dropZones = [];
    const layouts = sceneGraph.findAllObjects(this.getRoot(), isSceneLayout) as SceneLayout2[];
    for (const l of layouts) {
      dropZones.push(...l.getDropZones().map((v) => ({ ...v, layoutKey: l.state.key! })));
    }

    this.dropZones = dropZones;
  }

  // LayoutManager methods
  editModeChanged(isEditing: boolean): void {
    return this.state.manager.editModeChanged?.(isEditing);
  }

  removePanel(panel: VizPanel): void {
    return this.state.manager.removePanel?.(panel);
  }

  duplicatePanel(panel: VizPanel): void {
    return this.state.manager.duplicatePanel?.(panel);
  }

  addPanel(panel: VizPanel): void {
    return this.state.manager.addPanel(panel);
  }

  addNewRow(): void {
    return this.state.manager.addNewRow();
  }

  getVizPanels(): VizPanel[] {
    return this.state.manager.getVizPanels();
  }

  toSaveModel() {
    return this.state.manager.toSaveModel?.() ?? {};
  }

  activateRepeaters?(): void {
    return this.state.manager.activateRepeaters?.();
  }

  getOptions?(): OptionsPaneItemDescriptor[] {
    return this.state.manager.getOptions?.() ?? [];
  }

  public switchLayout(layoutManager: DashboardLayoutManager) {
    this.setState({ manager: layoutManager });
  }

  public cloneLayout(ancestorKey: string, isSource: boolean): DashboardLayoutManager {
    return this.state.manager.cloneLayout(ancestorKey, isSource);
  }

  public static Component = ({ model }: SceneComponentProps<LayoutOrchestrator>) => {
    const {
      manager,
      activeItemRef,
      activeItemDimensions = { width: 50, height: 50, left: 0, top: 0 },
    } = model.useState();

    const activeItem = activeItemRef?.resolve();
    return (
      <>
        <Portal>
          {activeItem && <DropZonePlaceholder width={1} height={1} top={1} left={1} ref={model.placeholderRef} />}
          <FloatingPanel
            width={activeItemDimensions.width}
            height={activeItemDimensions.height}
            offset={{ left: activeItemDimensions.left, top: activeItemDimensions.top }}
            ref={model.floatingPanelRef}
          >
            {activeItem && <activeItem.Component model={activeItem} />}
          </FloatingPanel>
        </Portal>
        <model.state.manager.Component model={manager} />
      </>
    );
  };
}
