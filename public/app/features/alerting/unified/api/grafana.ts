import { getBackendSrv } from '@grafana/runtime';
import { ContactPointsState, NotifierDTO, ReceiversStateDTO } from 'app/types';

export function fetchNotifiers(): Promise<NotifierDTO[]> {
  return getBackendSrv().get(`/api/alert-notifiers`);
}

export function fetchContactPointsState(alertManagerSourceName: String): Promise<ContactPointsState> {
  const getIntegrationType = (integrationName: string): string =>
    integrationName.indexOf('[') !== -1 ? integrationName.substring(0, integrationName.indexOf('[')) : integrationName;

  const contactPointsStateDtoToModel = (receiversSateDto: ReceiversStateDTO[]): ContactPointsState => {
    //init object to return
    const contactPointpState: ContactPointsState = { receivers: {}, errorCount: 0 };

    // for each receiver from response
    receiversSateDto.forEach((cpState) => {
      //init receiver state
      contactPointpState.receivers[cpState.name] = { active: cpState.active, integrations: {}, errorCount: 0 };
      const receiverState = contactPointpState.receivers[cpState.name];
      //update integrations in response
      cpState.integrations.forEach((integrationStatusDTO) => {
        //update errorcount
        const hasError = Boolean(integrationStatusDTO?.lastError);
        if (hasError) {
          receiverState.errorCount += 1;
          contactPointpState.errorCount += 1;
        }
        //add integration for this type
        const type = getIntegrationType(integrationStatusDTO.name);
        //if type still does not exist in IntegrationsTypeState we initialize it with an empty array
        if (!receiverState.integrations[type]) {
          receiverState.integrations[type] = [];
        }
        // add error status for this type
        receiverState.integrations[type].push(integrationStatusDTO);
      });
    });
    return contactPointpState;
  };
  return new Promise<ContactPointsState>((resolve) => {
    // Response EXAMPLE
    //    const fakeResponse = [
    //   {
    //     "active": true, // Whether the contact point is used or not.
    //     "integrations": [ // Can be multiple of the same type. Are identified by the index.
    //       {
    //         "lastError": "establish connection to server: dial tcp: lookup smtp.example.org on 8.8.8.8:53: no such host",
    //         "lastNotify": "2022-07-08 17:42:44.998893 +0000 UTC",
    //         "lastNotifyDuration": "117.2455ms",
    //         "name": "email[0]"
    //       },
    //       {
    //         "lastError": "establish connection to server: dial tcp: lookup smtp.example.org on 8.8.8.8:53: no such host",
    //         "lastNotify": "2022-07-08 17:42:44.998893 +0000 UTC",
    //         "lastNotifyDuration": "117.2455ms",
    //         "name": "email[1]"
    //       }
    //     ],
    //     "name": "multiple3"
    //   },
    //   {
    //     "active": true, // Whether the contact point is used or not.
    //     "integrations": [ // Can be multiple of the same type. Are identified by the index.
    //       {
    //         "lastNotify": "2022-07-08 17:42:44.998893 +0000 UTC",
    //         "lastNotifyDuration": "117.2455ms",
    //         "name": "email[0]"
    //       }
    //     ],
    //     "name": "grafana-default-email"
    //   },
    // ]

    const fakeState: ContactPointsState = contactPointsStateDtoToModel([]);
    setTimeout(() => {
      resolve(fakeState);
    }, 1000);
  });
}
