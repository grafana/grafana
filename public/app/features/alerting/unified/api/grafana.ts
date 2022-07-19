import { getBackendSrv } from '@grafana/runtime';
import { ContactPointsState, NotifierDTO } from 'app/types';

export function fetchNotifiers(): Promise<NotifierDTO[]> {
  return getBackendSrv().get(`/api/alert-notifiers`);
}

export function fetchContactPointsState(alertManagerSourceName: String): Promise<ContactPointsState> {
  return new Promise<ContactPointsState>((resolve) => {
    //WIP: Example of possible response:
    // const emailInt: IntegrationState = {
    //   ['Email']: [{
    //     lastError: 'Error',
    //     lastNotify:'',
    //     lastNotifyDuration: '117.2455ms'
    //   }]
    // }
    // const grafanaDefaultEmailState: ReceiverState = {
    //   active: true,
    //   integrations: [emailInt],
    //   errorCount: 1
    // }
    // const multipleState: ReceiverState = {
    //   active: true,
    //   integrations: [emailInt, emailInt],
    //   errorCount: 2
    // }
    // const fakeReceivers: ReceiversState = {
    //   ['grafana-default-email']: grafanaDefaultEmailState,
    //   ['multiple3']: multipleState
    // }
    // const fakeState: ContactPointsState = { receivers: fakeReceivers, errorCount: 3};

    const fakeState: ContactPointsState = { receivers: {}, errorCount: 0 };
    setTimeout(() => {
      resolve(fakeState);
    }, 1000);
  });
}
