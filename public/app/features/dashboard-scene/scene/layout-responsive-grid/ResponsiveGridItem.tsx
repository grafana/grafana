import { SceneObjectState, VizPanel, SceneObjectBase } from '@grafana/scenes';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

import { DashboardLayoutItem } from '../types/DashboardLayoutItem';

import { getOptions } from './ResponsiveGridItemEditor';
import { ResponsiveGridItemRenderer } from './ResponsiveGridItemRenderer';
import { SceneCSSGridLayout } from './SceneCSSGridLayout';

export interface ResponsiveGridItemState extends SceneObjectState {
  body: VizPanel;
  hideWhenNoData?: boolean;

  // Dragging state
  dragged?: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

export class ResponsiveGridItem extends SceneObjectBase<ResponsiveGridItemState> implements DashboardLayoutItem {
  public static Component = ResponsiveGridItemRenderer;

  public _itemRef: HTMLDivElement | null = null;

  // The position and the size of the layout
  // This is used for various calculation and we memoize it here when dragging starts
  public _layoutRect: DOMRect | null = null;

  public readonly isDashboardLayoutItem = true;

  public getOptions(): OptionsPaneCategoryDescriptor {
    return getOptions(this);
  }

  public toggleHideWhenNoData() {
    this.setState({ hideWhenNoData: !this.state.hideWhenNoData });
  }

  public getParentGrid(): SceneCSSGridLayout {
    if (!(this.parent instanceof SceneCSSGridLayout)) {
      throw new Error('Parent is not a SceneCSSGridLayout');
    }

    return this.parent;
  }

  public setItemRef(ref: HTMLDivElement | null) {
    this._itemRef = ref;
  }

  public startDragging(layoutRect: DOMRect) {
    this._layoutRect = layoutRect;
    const { width, height } = this._itemRef!.getBoundingClientRect();
    this.setState({
      dragged: {
        top: this._itemRef!.offsetTop,
        left: this._itemRef!.offsetLeft,
        width,
        height,
      },
    });
  }

  public changeDraggingPosition(deltaX: number, deltaY: number) {
    if (!this.state.dragged || (deltaX === 0 && deltaY === 0)) {
      return;
    }

    const newTop = this.state.dragged.top + deltaY;
    const newLeft = this.state.dragged.left + deltaX;

    if (newTop !== this.state.dragged.top || newLeft !== this.state.dragged.left) {
      this.setState({ dragged: { ...this.state.dragged, top: newTop, left: newLeft } });
    }
  }

  public stopDragging() {
    this.setState({ dragged: undefined });
    this._layoutRect = null;
  }
}
