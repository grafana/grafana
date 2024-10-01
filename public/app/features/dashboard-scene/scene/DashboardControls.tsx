import { css } from '@emotion/css';

import { GrafanaTheme2, VariableHide } from '@grafana/data';
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
  sceneGraph,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  CancelActivationHandler,
} from '@grafana/scenes';
import { Box, Stack, useStyles2 } from '@grafana/ui';

import { PanelEditControls } from '../panel-edit/PanelEditControls';
import { getDashboardSceneFor } from '../utils/utils';

import { DashboardLinksControls } from './DashboardLinksControls';

export interface DashboardControlsState extends SceneObjectState {
  variableControls: SceneObject[];
  timePicker: SceneTimePicker;
  refreshPicker: SceneRefreshPicker;
  hideTimeControls?: boolean;
  hideVariableControls?: boolean;
  hideLinksControls?: boolean;
}

export class DashboardControls extends SceneObjectBase<DashboardControlsState> {
  static Component = DashboardControlsRenderer;

  protected _variableDependency = new VariableDependencyConfig(this, {
    onAnyVariableChanged: this._onAnyVariableChanged.bind(this),
  });

  protected _urlSync = new SceneObjectUrlSyncConfig(this, {
    keys: ['_dash.hideTimePicker', '_dash.hideVariables', '_dash.hideLinks'],
  });

  /**
   * We want the hideXX url keys to only sync one way (url => state) on init
   * We don't want these flags to be added to URL.
   */
  getUrlState() {
    return {};
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const { hideTimeControls, hideVariableControls, hideLinksControls } = this.state;
    const isEnabledViaUrl = (key: string) => values[key] === 'true' || values[key] === '';

    // Only allow hiding, never "unhiding" from url
    // Becasue this should really only change on first init it's fine to do multiple setState here

    if (!hideTimeControls && isEnabledViaUrl('_dash.hideTimePicker')) {
      this.setState({ hideTimeControls: true });
    }

    if (!hideVariableControls && isEnabledViaUrl('_dash.hideVariables')) {
      this.setState({ hideVariableControls: true });
    }

    if (!hideLinksControls && isEnabledViaUrl('_dash.hideLinks')) {
      this.setState({ hideLinksControls: true });
    }
  }

  public constructor(state: Partial<DashboardControlsState>) {
    super({
      variableControls: [],
      timePicker: state.timePicker ?? new SceneTimePicker({}),
      refreshPicker: state.refreshPicker ?? new SceneRefreshPicker({}),
      ...state,
    });

    this.addActivationHandler(() => {
      let refreshPickerDeactivation: CancelActivationHandler | undefined;

      if (this.state.hideTimeControls) {
        refreshPickerDeactivation = this.state.refreshPicker.activate();
      }

      return () => {
        if (refreshPickerDeactivation) {
          refreshPickerDeactivation();
        }
      };
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

  public hasControls(): boolean {
    const hasVariables = sceneGraph
      .getVariables(this)
      ?.state.variables.some((v) => v.state.hide !== VariableHide.hideVariable);
    const hasAnnotations = sceneGraph.getDataLayers(this).some((d) => d.state.isEnabled && !d.state.isHidden);
    const hasLinks = getDashboardSceneFor(this).state.links?.length > 0;
    const hideLinks = this.state.hideLinksControls || !hasLinks;
    const hideVariables = this.state.hideVariableControls || (!hasAnnotations && !hasVariables);
    const hideTimePicker = this.state.hideTimeControls;

    return !(hideVariables && hideLinks && hideTimePicker);
  }
}

function DashboardControlsRenderer({ model }: SceneComponentProps<DashboardControls>) {
  const { variableControls, refreshPicker, timePicker, hideTimeControls, hideVariableControls, hideLinksControls } =
    model.useState();
  const dashboard = getDashboardSceneFor(model);
  const { links, editPanel } = dashboard.useState();
  const styles = useStyles2(getStyles);
  const showDebugger = location.search.includes('scene-debugger');

  if (!model.hasControls()) {
    return null;
  }

  return (
    <div data-testid={selectors.pages.Dashboard.Controls} className={styles.controls}>
      <Stack grow={1} wrap={'wrap'}>
        {!hideVariableControls && variableControls.map((c) => <c.Component model={c} key={c.state.key} />)}
        <Box grow={1} />
        {!hideLinksControls && !editPanel && <DashboardLinksControls links={links} uid={dashboard.state.uid} />}
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
      position: 'relative',
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
