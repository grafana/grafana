import { SceneObjectState, VizPanel, SceneObjectBase } from '@grafana/scenes';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

import { ConditionalRendering } from '../../conditional-rendering/ConditionalRendering';
import { ConditionalRenderingGroup } from '../../conditional-rendering/ConditionalRenderingGroup';
import { DashboardLayoutItem } from '../types/DashboardLayoutItem';

import { getOptions } from './ResponsiveGridItemEditor';
import { ResponsiveGridItemRenderer } from './ResponsiveGridItemRenderer';

export interface ResponsiveGridItemState extends SceneObjectState {
  body: VizPanel;
}

export class ResponsiveGridItem extends SceneObjectBase<ResponsiveGridItemState> implements DashboardLayoutItem {
  public static Component = ResponsiveGridItemRenderer;

  public readonly isDashboardLayoutItem = true;

  public constructor(state: ResponsiveGridItemState) {
    super({
      ...state,
      $behaviors: [
        ...(state.$behaviors ?? []),
        new ConditionalRendering({
          rootGroup: new ConditionalRenderingGroup({
            condition: 'or',
            value: [],
          }),
        }),
      ],
    });
  }

  public getOptions(): OptionsPaneCategoryDescriptor {
    return getOptions(this);
  }
}
