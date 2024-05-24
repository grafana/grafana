import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import {
  SceneObjectState,
  SceneObject,
  SceneObjectBase,
  SceneComponentProps,
  SceneTimePicker,
  SceneRefreshPicker,
  SceneDebugger,
  VariableDependencyConfig,
} from '@grafana/scenes';
import { Box, Stack, useStyles2 } from '@grafana/ui';

import { PanelEditControls } from '../panel-edit/PanelEditControls';
import { getDashboardSceneFor } from '../utils/utils';

import { DashboardLinksControls } from './DashboardLinksControls';

interface DashboardControlsState extends SceneObjectState {
  variableControls: SceneObject[];
  timePicker: SceneTimePicker;
  refreshPicker: SceneRefreshPicker;
  hideTimeControls?: boolean;
}
export class DashboardControls extends SceneObjectBase<DashboardControlsState> {
  static Component = DashboardControlsRenderer;

  protected _variableDependency = new VariableDependencyConfig(this, {
    onAnyVariableChanged: this._onAnyVariableChanged.bind(this),
  });

  public constructor(state: Partial<DashboardControlsState>) {
    super({
      variableControls: [],
      timePicker: state.timePicker ?? new SceneTimePicker({}),
      refreshPicker: state.refreshPicker ?? new SceneRefreshPicker({}),
      ...state,
    });
  }

  /**
   * Links can include all variables so we need to re-render when any change
   */
  private _onAnyVariableChanged(): void {
    const dashboard = getDashboardSceneFor(this);
    if (dashboard.state.links?.length > 0) {
      this.forceRender();
    }
  }
}

function DashboardControlsRenderer({ model }: SceneComponentProps<DashboardControls>) {
  const { variableControls, refreshPicker, timePicker, hideTimeControls } = model.useState();
  const dashboard = getDashboardSceneFor(model);
  const { links, meta, editPanel } = dashboard.useState();
  const styles = useStyles2(getStyles);
  const showDebugger = location.search.includes('scene-debugger');

  return (
    <div
      data-testid={selectors.pages.Dashboard.Controls}
      className={cx(styles.controls, meta.isEmbedded && styles.embedded)}
    >
      <Stack grow={1} wrap={'wrap'}>
        {variableControls.map((c) => (
          <c.Component model={c} key={c.state.key} />
        ))}
        <Box grow={1} />
        {!editPanel && <DashboardLinksControls links={links} uid={dashboard.state.uid} />}
        {editPanel && <PanelEditControls panelEditor={editPanel} />}
      </Stack>
      {!hideTimeControls && (
        <Stack justifyContent={'flex-end'}>
          <timePicker.Component model={timePicker} />
          <refreshPicker.Component model={refreshPicker} />
        </Stack>
      )}
      {showDebugger && <SceneDebugger scene={model} key={'scene-debugger'} />}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    controls: css({
      display: 'flex',
      alignItems: 'flex-start',
      flex: '100%',
      gap: theme.spacing(1),
      flexDirection: 'row',
      flexWrap: 'nowrap',
      position: 'sticky',
      top: 0,
      background: theme.colors.background.canvas,
      zIndex: theme.zIndex.activePanel,
      width: '100%',
      marginLeft: 'auto',
      [theme.breakpoints.down('sm')]: {
        flexDirection: 'column-reverse',
        alignItems: 'stretch',
      },
    }),
    embedded: css({
      background: 'unset',
      position: 'unset',
    }),
  };
}
