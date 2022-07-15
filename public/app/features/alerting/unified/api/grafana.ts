import { getBackendSrv } from '@grafana/runtime';
import { ContactPointStateDTO, NotifierDTO } from 'app/types';

export function fetchNotifiers(): Promise<NotifierDTO[]> {
  return getBackendSrv().get(`/api/alert-notifiers`);
}

export function fetchContactPointsState(alertManagerSourceName: String): Promise<ContactPointStateDTO[]> {
  return new Promise<ContactPointStateDTO[]>((resolve) => {
    setTimeout(() => {
      resolve([]);
    }, 1000);
  });
}
