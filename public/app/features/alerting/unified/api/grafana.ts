import { lastValueFrom } from 'rxjs';

import { getBackendSrv } from '@grafana/runtime';
import { ContactPointsState, ReceiverState, ReceiversStateDTO } from 'app/features/alerting/unified/types/alerting';

import { getDatasourceAPIUid } from '../utils/datasource';

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
      const hasError = Boolean(integrationStatusDTO?.lastNotifyAttemptError);
      if (hasError) {
        receiverState.errorCount += 1;
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
  const errorsCount = Object.values(contactPointsState.receivers).reduce(
    (prevCount: number, receiverState: ReceiverState) => prevCount + receiverState.errorCount,
    0
  );
  return { ...contactPointsState, errorCount: errorsCount };
};

export const getIntegrationType = (integrationName: string): string | undefined =>
  parseIntegrationName(integrationName)?.type;

export async function fetchContactPointsState(alertManagerSourceName: string): Promise<ContactPointsState> {
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
    return contactPointsStateDtoToModel([]);
  }
}
