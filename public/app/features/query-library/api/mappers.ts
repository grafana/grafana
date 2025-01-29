import { v4 as uuidv4 } from 'uuid';

import { AddQueryTemplateCommand, QueryTemplate } from '../types';

import { ListQueryTemplateApiResponse, QueryTemplate as QT } from './endpoints.gen';
import { API_VERSION, QueryTemplateKinds } from './query';
import { CREATED_BY_KEY } from './types';

export const convertDataQueryResponseToQueryTemplates = (result: ListQueryTemplateApiResponse): QueryTemplate[] => {
  if (!result.items) {
    return [];
  }
  return result.items.map((spec) => {
    return {
      uid: spec.metadata?.name ?? '',
      title: spec.spec?.title ?? '',
      targets:
        spec.spec?.targets.map((target) => ({
          ...target.properties,
          refId: target.properties.refId ?? '',
        })) ?? [],
      createdAtTimestamp: new Date(spec.metadata?.creationTimestamp ?? '').getTime(),
      user: {
        uid: spec.metadata?.annotations?.[CREATED_BY_KEY] ?? '',
      },
    };
  });
};

export const convertAddQueryTemplateCommandToDataQuerySpec = (addQueryTemplateCommand: AddQueryTemplateCommand): QT => {
  const { title, targets } = addQueryTemplateCommand;
  return {
    apiVersion: API_VERSION,
    kind: QueryTemplateKinds.QueryTemplate,
    metadata: {
      /**
       * Server will append to whatever is passed here, but just to be safe we generate a uuid
       * More info https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#idempotency
       */
      generateName: uuidv4(),
    },
    spec: {
      title: title,
      vars: [], // TODO: Detect variables in #86838
      targets: targets.map((dataQuery) => ({
        variables: {},
        properties: {
          ...dataQuery,
          datasource: {
            ...dataQuery.datasource,
            type: dataQuery.datasource?.type ?? '',
          },
        },
      })),
    },
  };
};
