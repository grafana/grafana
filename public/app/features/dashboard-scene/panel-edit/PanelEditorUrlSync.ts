import { AppEvents } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { SceneObjectUrlSyncHandler, SceneObjectUrlValues } from '@grafana/scenes';
import appEvents from 'app/core/app_events';

import { PanelInspectDrawer } from '../inspect/PanelInspectDrawer';
import { findVizPanelByKey } from '../utils/utils';

import { PanelEditor, PanelEditorState } from './PanelEditor';

export class PanelEditorUrlSync implements SceneObjectUrlSyncHandler {
  constructor(private _scene: PanelEditor) {}

  getKeys(): string[] {
    return ['inspect'];
  }

  getUrlState(): SceneObjectUrlValues {
    const state = this._scene.state;
    return {
      inspect: state.inspectPanelKey,
    };
  }

  updateFromUrl(values: SceneObjectUrlValues): void {
    const { inspectPanelKey } = this._scene.state;
    const update: Partial<PanelEditorState> = {};

    // Handle inspect object state
    if (typeof values.inspect === 'string') {
      const panel = findVizPanelByKey(this._scene, values.inspect);
      if (!panel) {
        appEvents.emit(AppEvents.alertError, ['Panel not found']);
        locationService.partial({ inspect: null });
        return;
      }

      update.inspectPanelKey = values.inspect;
      update.overlay = new PanelInspectDrawer({ panelRef: panel.getRef() });
    } else if (inspectPanelKey) {
      update.inspectPanelKey = undefined;
      update.overlay = undefined;
    }

    if (Object.keys(update).length > 0) {
      this._scene.setState(update);
    }
  }
}
