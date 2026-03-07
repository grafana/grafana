import { generatedAPI, type CreateTeamApiArg } from '@grafana/api-clients/rtkq/legacy';

interface CreateTeamApiArgWithNotificationOptions extends CreateTeamApiArg {
  showSuccessAlert?: boolean;
}

export const legacyAPI = generatedAPI.enhanceEndpoints({
  endpoints: {
    createTeam: (endpointDefinition) => {
      const originalQuery = endpointDefinition.query;
      if (!originalQuery) {
        return;
      }

      endpointDefinition.query = (queryArg: CreateTeamApiArgWithNotificationOptions) => {
        const requestOptions = originalQuery(queryArg);
        return {
          ...requestOptions,
          // Because createTeam API returns a message prop in the response, it would always generate a success toast
          // which may not be always wanted.
          ...(queryArg.showSuccessAlert !== undefined && { showSuccessAlert: queryArg.showSuccessAlert }),
        };
      };
    },
  },
});

// eslint-disable-next-line no-barrel-files/no-barrel-files
export * from '@grafana/api-clients/rtkq/legacy';
