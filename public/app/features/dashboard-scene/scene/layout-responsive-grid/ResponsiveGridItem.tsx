import { CSSProperties } from 'react';

import { SceneObjectState, VizPanel, SceneObjectBase, SceneObject, SceneComponentProps } from '@grafana/scenes';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

import { DashboardLayoutItem } from '../types/DashboardLayoutItem';

import { getOptions } from './ResponsiveGridItemEditor';
import { ResponsiveGridItemRenderer } from './ResponsiveGridItemRenderer';

export interface ResponsiveGridItemStatePlacement {
  /**
   * Useful for making content span across multiple rows or columns
   */
  gridColumn?: CSSProperties['gridColumn'];
  gridRow?: CSSProperties['gridRow'];
}

export interface ResponsiveGridItemState extends SceneObjectState {
  body: VizPanel;
  hideWhenNoData?: boolean;
  gridColumn?: CSSProperties['gridColumn'];
  gridRow?: CSSProperties['gridRow'];
}

export interface ResponsiveGridItemRenderProps<T> extends SceneComponentProps<T> {}

export class ResponsiveGridItem extends SceneObjectBase<ResponsiveGridItemState> implements DashboardLayoutItem {
  public static Component = ResponsiveGridItemRenderer;

  public readonly isDashboardLayoutItem = true;

  public getOptions(): OptionsPaneCategoryDescriptor {
    return getOptions(this);
  }

  public toggleHideWhenNoData() {
    this.setState({ hideWhenNoData: !this.state.hideWhenNoData });
  }

  public setBody(body: SceneObject): void {
    if (body instanceof VizPanel) {
      this.setState({ body });
    }
  }

  public getVizPanel() {
    return this.state.body;
  }
}

// function getStyles(theme: GrafanaTheme2, state: ResponsiveGridItemState) {
//   return {
//     wrapper: css({
//       gridColumn: state.gridColumn || 'unset',
//       gridRow: state.gridRow || 'unset',
//       position: 'relative',
//     }),
//   };
// }
