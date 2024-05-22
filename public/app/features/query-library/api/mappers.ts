import { contextSrv } from 'app/core/core';

import { AddQueryTemplateCommand, QueryTemplate } from '../types';

import { API_VERSION, QueryTemplateKinds } from './query';
import { DataQuerySpec, DataQuerySpecResponse, DataQueryTarget } from './types';

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
    };
  });
};

export const convertAddQueryTemplateCommandToDataQuerySpec = (
  addQueryTemplateCommand: AddQueryTemplateCommand
): DataQuerySpec => {
  const { title, targets } = addQueryTemplateCommand;
  console.log(contextSrv.user);
  return {
    apiVersion: API_VERSION,
    kind: QueryTemplateKinds.QueryTemplate,
    metadata: {
      generateName: 'A' + title,
      user: {
        uid: contextSrv.user.uid,
        login: contextSrv.user.login,
        orgId: contextSrv.user.orgId,
      },
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
