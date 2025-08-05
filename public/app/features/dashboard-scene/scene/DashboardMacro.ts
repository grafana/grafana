import { FormatVariable, SceneObject, sceneUtils } from '@grafana/scenes';

import { getDashboardSceneFor } from '../utils/utils';

import { getTimeValue, getTimeValueText } from './TimeRangeMacroHelpers';

/**
 * Handles expressions like ${__dashboard.uid}
 */
class DashboardMacro implements FormatVariable {
  public state: { name: string; type: string };

  public constructor(
    name: string,
    private _sceneObject: SceneObject
  ) {
    this.state = { name: name, type: 'dashboard_macro' };
  }

  public getValue(fieldPath?: string): string | number | undefined {
    const dashboard = getDashboardSceneFor(this._sceneObject);
    const thisPath = currentPath(fieldPath);
    switch (thisPath) {
      case 'uid':
        return dashboard.state.uid || '';
      case 'timeRange':
        return getTimeValue(dashboard, fieldPath)?.valueOf() || '';
      case 'url':
        return dashboard.getSnapshotUrl();
      case 'title':
      case 'name':
      case 'id':
      default:
        return dashboard.state.title;
    }
  }

  public getValueText?(fieldPath?: string): string {
    const dashboard = getDashboardSceneFor(this._sceneObject);
    const thisPath = currentPath(fieldPath);
    switch (thisPath) {
      case 'timeRange':
        return getTimeValueText(dashboard, fieldPath) || '';
      default:
        return '';
    }
  }
}

export function registerDashboardMacro() {
  try {
    const unregister = sceneUtils.registerVariableMacro('__dashboard', DashboardMacro);

    return () => unregister();
  } catch (e) {
    console.error('Error registering dashboard macro', e);
    return () => {};
  }
}

function currentPath(fieldPath?: string): string | undefined {
  const fragments = fieldPath?.split('.');
  return fragments?.[0];
}
