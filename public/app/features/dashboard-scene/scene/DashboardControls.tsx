import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import {
  SceneObjectState,
  SceneObject,
  SceneObjectBase,
  SceneComponentProps,
  SceneTimePicker,
  SceneRefreshPicker,
  SceneDebugger,
} from '@grafana/scenes';
import { Box, Stack, useStyles2 } from '@grafana/ui';

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
}

function DashboardControlsRenderer({ model }: SceneComponentProps<DashboardControls>) {
  const { variableControls, refreshPicker, timePicker, hideTimeControls } = model.useState();
  const dashboard = getDashboardSceneFor(model);
  const { links } = dashboard.useState();
  const styles = useStyles2(getStyles);
  const showDebugger = location.search.includes('scene-debugger');

  return (
    <div className={styles.controls}>
      <Stack
        grow={1}
        direction={{
          md: 'row',
          xs: 'column',
        }}
      >
        <Stack grow={1} wrap={'wrap'}>
          {variableControls.map((c) => (
            <c.Component model={c} key={c.state.key} />
          ))}
          <Box grow={1} />
          <DashboardLinksControls links={links} uid={dashboard.state.uid} />
        </Stack>
        {!hideTimeControls && (
          <Stack justifyContent={'flex-end'}>
            <timePicker.Component model={timePicker} />
            <refreshPicker.Component model={refreshPicker} />
          </Stack>
        )}
        {showDebugger && <SceneDebugger scene={model} key={'scene-debugger'} />}
      </Stack>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    controls: css({
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: theme.spacing(1),
      position: 'sticky',
      top: 0,
      background: theme.colors.background.canvas,
      zIndex: theme.zIndex.activePanel,
      padding: theme.spacing(2, 0),
      width: '100%',
      marginLeft: 'auto',
    }),
  };
}
