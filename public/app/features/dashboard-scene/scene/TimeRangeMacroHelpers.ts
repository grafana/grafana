import { dateTimeFormat } from '@grafana/data';
import { sceneGraph, SceneObject } from '@grafana/scenes';

export function getTimeValueText(sceneObject: SceneObject, fieldPath?: string) {
  const timeValue = getTimeValue(sceneObject, fieldPath);
  if (!timeValue) {
    return '';
  }
  return dateTimeFormat(timeValue, { timeZone: sceneGraph.getTimeRange(sceneObject).getTimeZone() });
}

export function getTimeValue(sceneObject: SceneObject, fieldPath?: string) {
  const path = fieldPath?.split('.');
  if (path?.[0] !== 'timeRange') {
    return;
  }
  const timeRange = sceneGraph.getTimeRange(sceneObject);
  switch (path[1]) {
    case 'from':
      return timeRange.state.value.from;
    case 'to':
      return timeRange.state.value.to;
    default:
      return;
  }
}
