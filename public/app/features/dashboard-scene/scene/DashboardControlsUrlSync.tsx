import { SceneObjectUrlSyncHandler, SceneObjectUrlValues } from '@grafana/scenes';

import { DashboardControls } from './DashboardControls';

export class DashboardControlsUrlSync implements SceneObjectUrlSyncHandler {
  constructor(private _scene: DashboardControls) {}

  getKeys() {
    return ['_dash.hideTimePicker', '_dash.hideVariables', '_dash.hideLinks'];
  }

  getUrlState() {
    return {
      '_dash.hideTimePicker': this._scene.state.hideTimeControls ? 'true' : undefined,
      '_dash.hideVariables': this._scene.state.hideVariableControls ? 'true' : undefined,
      '_dash.hideLinks': this._scene.state.hideLinksControls ? 'true' : undefined,
    };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const update: Partial<(typeof DashboardControls.prototype)['state']> = {};

    if (values['_dash.hideTimePicker'] === 'true' || values['_dash.hideTimePicker'] === '') {
      update.hideTimeControls = true;
    }
    if (values['_dash.hideVariables'] === 'true' || values['_dash.hideVariables'] === '') {
      update.hideVariableControls = true;
    }
    if (values['_dash.hideLinks'] === 'true' || values['_dash.hideLinks'] === '') {
      update.hideLinksControls = true;
    }

    console.log('update', update);

    if (Object.keys(update).length > 0) {
      this._scene.setState(update);
    }
  }
}
