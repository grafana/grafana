import { getBackendSrv } from '@grafana/runtime';
import { ContactPointsState, NotifierDTO, ReceiversStateDTO } from 'app/types';

export function fetchNotifiers(): Promise<NotifierDTO[]> {
  return getBackendSrv().get(`/api/alert-notifiers`);
}

export function fetchContactPointsState(alertManagerSourceName: String): Promise<ContactPointsState> {
  const getIntegrationType = (integrationName: string): string =>
    integrationName.indexOf('[') !== -1 ? integrationName.substring(0, integrationName.indexOf('[')) : integrationName;

  const contactPointsStateDtoToModel = (receiversStateDto: ReceiversStateDTO[]): ContactPointsState => {
    // init object to return
    const contactPointsState: ContactPointsState = { receivers: {}, errorCount: 0 };

    // for each receiver from response
    receiversStateDto.forEach((cpState) => {
      //init receiver state
      contactPointsState.receivers[cpState.name] = { active: cpState.active, integrations: {}, errorCount: 0 };
      const receiverState = contactPointsState.receivers[cpState.name];
      //update integrations in response
      cpState.integrations.forEach((integrationStatusDTO) => {
        //update errorcount
        const hasError = Boolean(integrationStatusDTO?.lastError);
        if (hasError) {
          receiverState.errorCount += 1;
          contactPointsState.errorCount += 1;
        }
        //add integration for this type
        const integrationType = getIntegrationType(integrationStatusDTO.name);
        //if type still does not exist in IntegrationsTypeState we initialize it with an empty array
        if (!receiverState.integrations[integrationType]) {
          receiverState.integrations[integrationType] = [];
        }
        // add error status for this type
        receiverState.integrations[integrationType].push(integrationStatusDTO);
      });
    });
    return contactPointsState;
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
