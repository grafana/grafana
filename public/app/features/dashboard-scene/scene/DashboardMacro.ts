import { FormatVariable, SceneObject, sceneUtils } from '@grafana/scenes';

import { getDashboardSceneFor } from '../utils/utils';

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

  public getValue(fieldPath?: string): string {
    const dashboard = getDashboardSceneFor(this._sceneObject);
    switch (fieldPath) {
      case 'uid':
        return dashboard.state.uid || '';
      case 'title':
      case 'name':
      case 'id':
      default:
        return dashboard.state.title;
    }
  }

  public getValueText?(): string {
    return '';
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
