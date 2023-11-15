import { FormatVariable, SceneObject, sceneUtils } from '@grafana/scenes';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';

/**
 * Handles expressions like ${__dashboard.uid}
 */
const getDashboardMacro = (dashboard: DashboardModel) => {
  return class DashboardMacro implements FormatVariable {
    public state: { name: string; type: string };

    public constructor(name: string, _: SceneObject) {
      this.state = { name: name, type: 'dashboard_macro' };
    }

    public getValue(fieldPath?: string): string {
      switch (fieldPath) {
        case 'uid':
          return dashboard.uid;
        case 'title':
        case 'name':
        case 'id':
        default:
          return String(dashboard.title);
      }
    }

    public getValueText?(): string {
      return '';
    }
  };
};

export function registerDashboardMacro(dashboard: DashboardModel) {
  return () => {
    const unregister = sceneUtils.registerVariableMacro('__dashboard', getDashboardMacro(dashboard));

    return () => unregister();
  };
}
