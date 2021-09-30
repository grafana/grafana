import { getBackendSrv } from '@grafana/runtime';
import { PipelineListOption, EntitiesTypes, PipeLineEntitiesInfo } from './types';

export async function getPipeLineEntities(): Promise<PipeLineEntitiesInfo> {
  return await getBackendSrv()
    .get(`api/live/pipeline-entities`)
    .then((data) => {
      return {
        converter: transformLabel(data, 'converters'),
        processor: transformLabel(data, 'processors'),
        output: transformLabel(data, 'outputs'),
        getExample: (ruleType, type) => {
          return data[`${ruleType}s`]?.filter((option: PipelineListOption) => option.type === type)?.[0]?.['example'];
        },
      };
    });
}

function transformLabel(data: EntitiesTypes, key: keyof typeof data) {
  return data[key].map((typeObj: PipelineListOption) => ({
    label: typeObj.type,
    value: typeObj.type,
  }));
}
