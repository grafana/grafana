import { css, cx } from '@emotion/css';

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

  getUrlState() {
    return {
      '_dash.hideTimePicker': this.state.hideTimeControls ? 'true' : undefined,
      '_dash.hideVariables': this.state.hideVariableControls ? 'true' : undefined,
      '_dash.hideLinks': this.state.hideLinksControls ? 'true' : undefined,
    };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const update: Partial<DashboardControlsState> = {};

    update.hideTimeControls =
      values['_dash.hideTimePicker'] === 'true' || values['_dash.hideTimePicker'] === '' || this.state.hideTimeControls;
    update.hideVariableControls =
      values['_dash.hideVariables'] === 'true' ||
      values['_dash.hideVariables'] === '' ||
      this.state.hideVariableControls;
    update.hideLinksControls =
      values['_dash.hideLinks'] === 'true' || values['_dash.hideLinks'] === '' || this.state.hideLinksControls;

    if (Object.entries(update).some(([k, v]) => v !== this.state[k as keyof DashboardControlsState])) {
      this.setState(update);
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
  const { links, meta, editPanel } = dashboard.useState();
  const styles = useStyles2(getStyles);
  const showDebugger = location.search.includes('scene-debugger');

  if (!model.hasControls()) {
    return null;
  }

  return (
    <div
      data-testid={selectors.pages.Dashboard.Controls}
      className={cx(styles.controls, meta.isEmbedded && styles.embedded)}
    >
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
      background: theme.colors.background.canvas,
      zIndex: theme.zIndex.activePanel,
      width: '100%',
      marginLeft: 'auto',
      [theme.breakpoints.down('sm')]: {
        flexDirection: 'column-reverse',
        alignItems: 'stretch',
      },
      [theme.breakpoints.up('sm')]: {
        position: 'sticky',
        top: 0,
      },
    }),
    embedded: css({
      background: 'unset',
      position: 'unset',
    }),
  };
}
