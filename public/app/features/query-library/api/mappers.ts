import { AddQueryTemplateCommand, QueryTemplate } from '../types';

import { API_VERSION, QueryTemplateKinds } from './query';
import { CREATED_BY_KEY, DataQueryFullSpec, DataQuerySpecResponse, DataQueryTarget } from './types';

export const convertDataQueryResponseToQueryTemplates = (result: DataQuerySpecResponse): QueryTemplate[] => {
  if (!result.items) {
    return [];
  }
  return result.items.map((spec) => {
    return {
      uid: spec.metadata.name || '',
      title: spec.spec.title,
      targets: spec.spec.targets.map((target: DataQueryTarget) => target.properties),
      createdAtTimestamp: new Date(spec.metadata.creationTimestamp || '').getTime(),
      user: {
        uid: spec.metadata.annotations?.[CREATED_BY_KEY] || '',
      },
    };
  });
};

export const convertAddQueryTemplateCommandToDataQuerySpec = (
  addQueryTemplateCommand: AddQueryTemplateCommand
): DataQueryFullSpec => {
  const { title, targets } = addQueryTemplateCommand;
  return {
    apiVersion: API_VERSION,
    kind: QueryTemplateKinds.QueryTemplate,
    metadata: {
      generateName: 'A' + title.replaceAll(' ', '-'),
    },
    spec: {
      title: title,
      vars: [], // TODO: Detect variables in #86838
      targets: targets.map((dataQuery) => ({
        variables: {},
        properties: dataQuery,
      })),
    },
  };
};
