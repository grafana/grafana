import { TimeRange } from '@grafana/data';
import { convertToStoreState } from './convertToStoreState';
import { TemplateSrv } from '../../app/features/templating/template_srv';
import { getTemplateSrvDependencies } from './getTemplateSrvDependencies';

export function initTemplateSrv(uid: string, variables: any[], timeRange?: TimeRange) {
  const state = convertToStoreState(uid, variables);
  const srv = new TemplateSrv(getTemplateSrvDependencies(state));
  srv.init(variables, timeRange);

  return srv;
}
