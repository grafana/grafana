// Libraries
import _ from 'lodash';

import { getBackendSrv } from 'app/core/services/backend_srv';
import { appEvents } from 'app/core/core';

import { PanelModel, PanelRef } from './PanelModel';
import { DashboardModel } from './index';

// Keep these fields when loading a referenced panel
const ignoreForReference: { [str: string]: boolean } = {
  id: true,
  gridPos: true,
  scopedVars: true,
  repeat: true,
  repeatIteration: true,
  repeatPanelId: true,
  repeatDirection: true,
  repeatedByRow: true,
  reference: true,
  snapshotData: true,

  events: true,
  fullscreen: true,
  isEditing: true,
  hasRefreshed: true,
};

export function copyReference(panel: PanelModel, ref: PanelModel) {
  // Remove fields that are not in the panel
  for (const key of _.keys(panel)) {
    if (!ref.hasOwnProperty(key) && !ignoreForReference[key]) {
      delete panel[key];
    }
  }

  // Copy all fields from the panel
  for (const key of _.keys(ref)) {
    if (ignoreForReference[key]) {
      continue;
    }
    panel[key] = ref[key];
  }
}

export class PanelReferenceInfo {
  dashboard?: DashboardModel;
  panel?: PanelModel;
  error?: string;

  toPanelRef(): PanelRef {
    return {
      dashboard: this.dashboard.uid,
      panelId: this.panel.id,
    };
  }
}

export function parsePanelRefFromPath(path: string): PanelRef {
  const ref: PanelRef = {
    dashboard: path,
    panelId: 0,
  };

  let idx = path.indexOf('d/');
  if (idx >= 0) {
    ref.dashboard = path.substring(idx + 2);
  }
  idx = ref.dashboard.indexOf('/');
  if (idx > 0) {
    ref.dashboard = ref.dashboard.substring(0, idx);
  }
  idx = ref.dashboard.indexOf('?');
  if (idx > 0) {
    ref.dashboard = ref.dashboard.substring(0, idx);
  }

  idx = path.indexOf('panelId=');
  if (idx > 0) {
    const id = path
      .substring(idx)
      .split('&')[0]
      .split('=')[1];
    ref.panelId = parseInt(id, 10);
  }
  return ref;
}

export function loadPanelRef(ref: PanelRef): Promise<PanelReferenceInfo> {
  const info = new PanelReferenceInfo();
  if (!ref || !ref.dashboard) {
    info.error = 'Missing Panel Reference';
    return Promise.resolve(info);
  }

  return getBackendSrv()
    .getDashboardByUid(ref.dashboard)
    .then(result => {
      info.dashboard = result.dashboard;
      if (ref.panelId > 0) {
        info.panel = _.find(result.dashboard.panels, { id: ref.panelId }) as PanelModel;
        if (!info.panel) {
          info.error = 'Reference panel Not Found';
        }
      }
      return info;
    })
    .catch(err => {
      err.isHandled = true;
      info.error = 'Can not find referenced dashboard: ' + err;
      return info;
    });
}

// Get panel reference, but emit events on errors
export function validateReference(path: string): Promise<PanelReferenceInfo> {
  const ref = parsePanelRefFromPath(path);
  if (!ref.dashboard) {
    const msg = 'Unable to parse dashboard';
    appEvents.emit('alert-warning', ['Reference Failed', msg]);
    return Promise.reject(msg);
  }

  return loadPanelRef(ref)
    .then(info => {
      if (info.dashboard) {
        if (!info.panel) {
          info.panel = info.dashboard.panels[0];
        }

        // Don't allow double reference
        if (info.panel.reference) {
          throw new Error('Can not link to a panel with reference');
        }
        return info;
      } else {
        throw new Error('Unable to load Dashboard');
      }
    })
    .catch(err => {
      let msg = 'Unable to load Dashboard';
      if (err.message) {
        msg = err.message;
      }
      appEvents.emit('alert-warning', ['Reference Failed', msg]);
      throw err;
    });
}
