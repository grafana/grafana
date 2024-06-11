import { AddQueryTemplateCommand, QueryTemplate } from '../types';

import { API_VERSION, QueryTemplateKinds } from './query';
import { CREATED_BY_KEY, DataQuerySpec, DataQuerySpecResponse, DataQueryTarget } from './types';

const parseCreatedByValue = (value?: string) => {
  // https://github.com/grafana/grafana/blob/main/pkg/services/store/auth.go#L27
  if (value !== undefined) {
    const vals = value.split(':');
    return {
      userId: vals[1],
      login: vals[2],
    };
  } else {
    return undefined;
  }
};

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
      user: parseCreatedByValue(spec.metadata?.annotations![CREATED_BY_KEY]),
    };
  });
};

export const convertAddQueryTemplateCommandToDataQuerySpec = (
  addQueryTemplateCommand: AddQueryTemplateCommand
): DataQuerySpec => {
  const { title, targets } = addQueryTemplateCommand;
  return {
    apiVersion: API_VERSION,
    kind: QueryTemplateKinds.QueryTemplate,
    metadata: {
      generateName: 'A' + title,
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
