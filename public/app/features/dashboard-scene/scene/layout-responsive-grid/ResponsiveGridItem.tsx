import { css } from '@emotion/css';
import { CSSProperties } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneObjectState, VizPanel, SceneObjectBase, SceneObject, SceneComponentProps } from '@grafana/scenes';
import { Switch, useStyles2 } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { DashboardLayoutItem } from '../types';

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
  public constructor(state: ResponsiveGridItemState) {
    super(state);
    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    if (!this.state.hideWhenNoData) {
      return;
    }
  }

  public toggleHideWhenNoData() {
    this.setState({ hideWhenNoData: !this.state.hideWhenNoData });
  }

  /**
   * DashboardLayoutElement interface
   */
  public isDashboardLayoutItem: true = true;

  public getOptions?(): OptionsPaneCategoryDescriptor {
    const model = this;

    const category = new OptionsPaneCategoryDescriptor({
      title: 'Layout options',
      id: 'layout-options',
      isOpenDefault: false,
    });

    category.addItem(
      new OptionsPaneItemDescriptor({
        title: 'Hide when no data',
        render: function renderTransparent() {
          const { hideWhenNoData } = model.useState();
          return <Switch value={hideWhenNoData} id="hide-when-no-data" onChange={() => model.toggleHideWhenNoData()} />;
        },
      })
    );

    return category;
  }

  public setBody(body: SceneObject): void {
    if (body instanceof VizPanel) {
      this.setState({ body });
    }
  }

  public getVizPanel() {
    return this.state.body;
  }

  public static Component = ({ model }: SceneComponentProps<ResponsiveGridItem>) => {
    const { body } = model.useState();
    const style = useStyles2(getStyles, model.state);

    console.log(`Body?: ${!!body}`);
    if (!body) {
      return null;
    }

    return (
      <div className={style.wrapper}>
        <body.Component model={body} />
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2, state: ResponsiveGridItemState) {
  return {
    wrapper: css({
      gridColumn: state.gridColumn || 'unset',
      gridRow: state.gridRow || 'unset',
      position: 'relative',
    }),
  };
}
