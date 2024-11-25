import { css, cx } from '@emotion/css';
import { useEffect, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneObjectState, SceneObjectBase, SceneComponentProps, SceneObject, SceneObjectRef } from '@grafana/scenes';
import { ToolbarButton, useStyles2 } from '@grafana/ui';

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
}

export interface Props {
  editPane: DashboardEditPane;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

/**
 * Making the EditPane rendering completely standalone (not using editPane.Component) in order to pass custom react props
 */
export function DashboardEditPaneRenderer({ editPane, isCollapsed, onToggleCollapse }: Props) {
  useEffect(() => {
    return editPane.activate();
  }, [editPane]);

  const { selectedObject } = editPane.useState();
  const styles = useStyles2(getStyles);
  const paneRef = useRef<HTMLDivElement>(null);

  if (!selectedObject) {
    return null;
  }

  if (isCollapsed) {
    return (
      <div className={styles.expandOptionsWrapper}>
        <ToolbarButton
          tooltip={'Open options pane'}
          icon={'arrow-to-right'}
          onClick={onToggleCollapse}
          variant="canvas"
          className={styles.rotate180}
          aria-label={'Open options pane'}
        />
      </div>
    );
  }

  return (
    <div className={styles.wrapper} ref={paneRef}>
      <ElementEditPane obj={selectedObject.resolve()} />
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 0',
      overflow: 'auto',
    }),
    rotate180: css({
      rotate: '180deg',
    }),
    expandOptionsWrapper: css({
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(2, 1),
    }),
  };
}
