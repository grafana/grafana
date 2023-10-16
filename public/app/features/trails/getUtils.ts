import { SceneObject } from '@grafana/scenes';

import { DataTrail } from './DataTrail';

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
