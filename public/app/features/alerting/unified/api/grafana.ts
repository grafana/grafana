import { lastValueFrom } from 'rxjs';

import { FetchError, getBackendSrv } from '@grafana/runtime';
import { ContactPointsState, NotifierDTO, ReceiversStateDTO } from 'app/types';

import { isFetchError } from '../../../../../../packages/grafana-runtime/src/services/backendSrv';
import { getDatasourceAPIUid } from '../utils/datasource';

export function fetchNotifiers(): Promise<NotifierDTO[]> {
  return getBackendSrv().get(`/api/alert-notifiers`);
}

interface IntegrationNameObject {
  type: string;
  index?: string;
}
export const parseIntegrationName = (integrationName: string): IntegrationNameObject => {
  const matches = integrationName.match(/^(\w+)(\[\d+\])?$/);
  if (!matches) {
    return { type: integrationName, index: undefined };
  }

  return {
    type: matches[1],
    index: matches[2],
  };
};

export const contactPointsStateDtoToModel = (receiversStateDto: ReceiversStateDTO[]): ContactPointsState => {
  // init object to return
  const contactPointsState: ContactPointsState = { receivers: {}, errorCount: 0 };

  // for each receiver from response
  receiversStateDto.forEach((cpState) => {
    //init receiver state
    contactPointsState.receivers[cpState.name] = { active: cpState.active, notifiers: {}, errorCount: 0 };
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
      if (integrationType) {
        //if type still does not exist in IntegrationsTypeState we initialize it with an empty array
        if (!receiverState.notifiers[integrationType]) {
          receiverState.notifiers[integrationType] = [];
        }
        // add error status for this type
        receiverState.notifiers[integrationType].push(integrationStatusDTO);
      }
    });
  });
  return contactPointsState;
};

export const getIntegrationType = (integrationName: string): string | undefined =>
  parseIntegrationName(integrationName)?.type;

function isContactPointsStateNotAvailable(error: FetchError) {
  return error.status === 404;
}

export async function fetchContactPointsState(alertManagerSourceName: string): Promise<ContactPointsState | undefined> {
  try {
    const response = await lastValueFrom(
      getBackendSrv().fetch<ReceiversStateDTO[]>({
        url: `/api/alertmanager/${getDatasourceAPIUid(alertManagerSourceName)}/config/api/v1/receivers`,
        showErrorAlert: false,
        showSuccessAlert: false,
      })
    );
    return contactPointsStateDtoToModel(response.data);
  } catch (error) {
    if (isFetchError(error)) {
      if (!isContactPointsStateNotAvailable(error)) {
        return contactPointsStateDtoToModel([]);
      } else {
        throw error;
      }
    } else {
      throw error;
    }
  }
}

// This method will be removed
export function fetchContactPointsState_(alertManagerSourceName: String): Promise<ContactPointsState> {
  return new Promise<ContactPointsState>((resolve, reject) => {
    // Response EXAMPLE
    const fakeResponse = [
      {
        active: true, // Whether the contact point is used or not.
        integrations: [
          // Can be multiple of the same type. Are identified by the index.
          {
            lastError: 'establish connection to server: dial tcp: lookup smtp.example.org on 8.8.8.8:53: no such host',
            lastNotify: '2022-09-19T15:34:40.696Z',
            lastNotifyDuration: '117.2455ms',
            name: 'email[0]',
          },
          {
            lastError: 'establish connection to server: dial tcp: lookup smtp.example.org on 8.8.8.8:53: no such host',
            lastNotify: '2022-09-19T15:34:40.696Z',
            lastNotifyDuration: '117.2455ms',
            name: 'email[1]',
          },
        ],
        name: 'multiple3',
      },
      {
        active: true, // Whether the contact point is used or not.
        integrations: [
          // Can be multiple of the same type. Are identified by the index.
          {
            lastNotify: '0001-01-01T00:00:00.000Z',
            lastNotifyDuration: '117.2455ms',
            name: 'email[0]',
          },
        ],
        name: 'grafana-default-email',
      },
    ];

    const fakeState: ContactPointsState = contactPointsStateDtoToModel(fakeResponse);

    setTimeout(() => {
      resolve(fakeState);
    }, 1000);
  });
}
