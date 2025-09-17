import { dateTimeFormat } from '@grafana/data';
import { FormatVariable, sceneGraph, SceneObject } from '@grafana/scenes';

/**
 * This macro is used to support the old __to and __from macros that always used the dashboard level time range.
 **/
export class DashboardLevelTimeMacro implements FormatVariable {
  public state: { name: string; type: string };
  private _sceneObject: SceneObject;

  public constructor(name: string, sceneObject: SceneObject) {
    this.state = { name: name, type: 'time_macro' };
    this._sceneObject = sceneObject.getRoot();
  }

  public getValue() {
    const timeRange = sceneGraph.getTimeRange(this._sceneObject);
    if (this.state.name === '__from') {
      return timeRange.state.value.from.valueOf();
    } else {
      return timeRange.state.value.to.valueOf();
    }
  }

  public getValueText?(): string {
    const timeRange = sceneGraph.getTimeRange(this._sceneObject);
    if (this.state.name === '__from') {
      return dateTimeFormat(timeRange.state.value.from, { timeZone: timeRange.getTimeZone() });
    } else {
      return dateTimeFormat(timeRange.state.value.to, { timeZone: timeRange.getTimeZone() });
    }
  }
}
