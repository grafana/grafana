import { css, cx } from '@emotion/css';

import { GrafanaTheme2, VariableHide } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import {
  SceneObjectState,
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

import { DashboardControlsMenu } from './DashboardControlsMenu';
import { DashboardLinksControls } from './DashboardLinksControls';
import { DashboardScene } from './DashboardScene';
import { VariableControls } from './VariableControls';

export interface DashboardControlsState extends SceneObjectState {
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
    // Because this should really only change on first init it's fine to do multiple setState here

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
  const { refreshPicker, timePicker, hideTimeControls, hideVariableControls, hideLinksControls } = model.useState();
  const dashboard = getDashboardSceneFor(model);
  const { links, editPanel } = dashboard.useState();
  const styles = useStyles2(getStyles);
  const showDebugger = window.location.search.includes('scene-debugger');
  const hasControlMenuVariables = sceneGraph
    .getVariables(dashboard)
    .useState()
    .variables.some((v) => v.state.showInControlsMenu === true);

  if (!model.hasControls()) {
    // To still have spacing when no controls are rendered
    return <Box padding={1} />;
  }

  return (
    <div
      data-testid={selectors.pages.Dashboard.Controls}
      className={cx(styles.controls, editPanel && styles.controlsPanelEdit)}
    >
      <Stack grow={1} wrap={'wrap'}>
        {!hideVariableControls && (
          <>
            <VariableControls dashboard={dashboard} />
            <DataLayerControls dashboard={dashboard} />
          </>
        )}
        <Box grow={1} />
        {!hideLinksControls && !editPanel && <DashboardLinksControls links={links} dashboard={dashboard} />}
        {editPanel && <PanelEditControls panelEditor={editPanel} />}
      </Stack>
      {!hideTimeControls && (
        <Stack justifyContent="flex-end">
          <timePicker.Component model={timePicker} />
          <refreshPicker.Component model={refreshPicker} />
        </Stack>
      )}
      {hasControlMenuVariables && (
        <Stack>
          <DashboardControlsMenu dashboard={dashboard} />
        </Stack>
      )}
      {showDebugger && <SceneDebugger scene={model} key={'scene-debugger'} />}
    </div>
  );
}

function DataLayerControls({ dashboard }: { dashboard: DashboardScene }) {
  const layers = sceneGraph.getDataLayers(dashboard, true);

  return (
    <>
      {layers.map((layer) => (
        <layer.Component model={layer} key={layer.state.key} />
      ))}
    </>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    controls: css({
      display: 'flex',
      alignItems: 'flex-start',
      flex: '100%',
      gap: theme.spacing(1),
      padding: theme.spacing(2),
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
    controlsPanelEdit: css({
      // In panel edit we do not need any right padding as the splitter is providing it
      paddingRight: 0,
    }),
    embedded: css({
      background: 'unset',
      position: 'unset',
    }),
  };
}
