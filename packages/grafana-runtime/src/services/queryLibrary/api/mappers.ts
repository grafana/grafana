import { dateTime } from '@grafana/data';

import { DataQuerySpecResponse, DataQueryTarget } from './types';

export const fromApiResponse = (result: DataQuerySpecResponse) => {
  if (!result.items) {
    return [];
  }
  return result.items.map((spec) => {
    return {
      uid: spec.metadata.name || '',
      title: spec.spec.title,
      targets: spec.spec.targets.map((target: DataQueryTarget) => target.properties),
      createdAtTimestamp: new Date(spec.metadata.creationTimestamp || '').getTime(),
      formattedDate: dateTime(spec.metadata.creationTimestamp).format('YYYY-MM-DD HH:mm:ss'),
    };
  });
};
