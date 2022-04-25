import { TimeRange } from '@grafana/data';

import { TemplateSrv } from '../../app/features/templating/template_srv';

import { convertToStoreState } from './convertToStoreState';
import { getTemplateSrvDependencies } from './getTemplateSrvDependencies';

export function initTemplateSrv(key: string, variables: any[], timeRange?: TimeRange) {
  const state = convertToStoreState(key, variables);
  const srv = new TemplateSrv(getTemplateSrvDependencies(state));
  srv.init(variables, timeRange);

  return srv;
}
