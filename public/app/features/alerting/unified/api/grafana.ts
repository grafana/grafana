import { getBackendSrv } from '@grafana/runtime';
import { ContactPointsState, NotifierDTO } from 'app/types';

export function fetchNotifiers(): Promise<NotifierDTO[]> {
  return getBackendSrv().get(`/api/alert-notifiers`);
}

export function fetchContactPointsState(alertManagerSourceName: String): Promise<ContactPointsState> {
  return new Promise<ContactPointsState>((resolve) => {
    const fakeState: ContactPointsState = { receivers: [], errorCount: 0 };
    setTimeout(() => {
      resolve(fakeState);
    }, 1000);
  });
}
