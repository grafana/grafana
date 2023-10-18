import { SceneObject } from '@grafana/scenes';

import { DataTrail } from './DataTrail';
import { DataTrailsApp } from './DataTrailsApp';

export function getTrailFor(model: SceneObject): DataTrail {
  if (model instanceof DataTrail) {
    return model;
  }

  if (model.parent) {
    return getTrailFor(model.parent);
  }

  console.error('Unable to find data trail for', model);

  throw new Error('Unable to find trail');
}

export function getTrailsAppFor(model: SceneObject): DataTrailsApp {
  if (model instanceof DataTrailsApp) {
    return model;
  }

  if (model.parent) {
    return getTrailsAppFor(model.parent);
  }

  console.error('Unable to find data trails app for', model);

  throw new Error('Unable to find trails app');
}
