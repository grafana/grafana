import { getBackendSrv } from '@grafana/runtime';

import { PipelineListOption, PipeLineEntitiesInfo } from './types';

export async function getPipeLineEntities(): Promise<PipeLineEntitiesInfo> {
  return await getBackendSrv()
    .get(`api/live/pipeline-entities`)
    .then((data) => {
      return {
        converter: transformLabel(data, 'converters'),
        frameProcessors: transformLabel(data, 'frameProcessors'),
        frameOutputs: transformLabel(data, 'frameOutputs'),
        getExample: (ruleType, type) => {
          return data[`${ruleType}s`]?.filter((option: PipelineListOption) => option.type === type)?.[0]?.['example'];
        },
      };
    });
}

export function transformLabel(data: any, key: keyof typeof data) {
  if (Array.isArray(data)) {
    return data.map((d) => ({
      label: d[key],
      value: d[key],
    }));
  }
  return data[key].map((typeObj: PipelineListOption) => ({
    label: typeObj.type,
    value: typeObj.type,
  }));
}
