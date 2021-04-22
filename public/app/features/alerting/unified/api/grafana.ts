import { getBackendSrv } from '@grafana/runtime';
import { NotifierDTO } from 'app/types';

export function fetchNotifiers(): Promise<NotifierDTO[]> {
  return getBackendSrv().get(`/api/alert-notifiers`);
}
