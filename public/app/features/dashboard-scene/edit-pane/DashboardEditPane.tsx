import { css, cx } from '@emotion/css';
import { useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneObjectState, SceneObjectBase, SceneComponentProps, SceneObject, SceneObjectRef } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { getDashboardSceneFor } from '../utils/utils';

import { ElementEditPane } from './ElementEditPane';

export interface DashboardEditPaneState extends SceneObjectState {
  selectedObject?: SceneObjectRef<SceneObject>;
}

export class DashboardEditPane extends SceneObjectBase<DashboardEditPaneState> {
  public constructor(state: DashboardEditPaneState) {
    super(state);
    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    if (!this.state.selectedObject) {
      const dashboard = getDashboardSceneFor(this);
      this.setState({ selectedObject: dashboard.getRef() });
    }
  }

  public static Component = ({ model }: SceneComponentProps<DashboardEditPane>) => {
    const { selectedObject } = model.useState();
    const style = useStyles2(getStyles);
    const paneRef = useRef<HTMLDivElement>(null);

    if (!selectedObject) {
      return null;
    }

    return (
      <div className={cx(style.wrapper)} ref={paneRef}>
        <ElementEditPane obj={selectedObject.resolve()} />
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 0',
      overflow: 'auto',
    }),
  };
}
