// Overriding the response types when enhancing endpoints is currently fiddly.
// The below approach is taken from/related to the below:
// https://github.com/reduxjs/redux-toolkit/issues/3901#issuecomment-1820995408
// https://github.com/reduxjs/redux-toolkit/issues/3443#issue-1709588268
//
// At the time of writing there is an open PR changing the API of `enhanceEndpoints`,
// which may help alleviate this when it lands:
// https://github.com/reduxjs/redux-toolkit/pull/3485

import { DefinitionsFromApi, OverrideResultType } from '@reduxjs/toolkit/dist/query/endpointDefinitions';

import {
  ListTimeIntervalForAllNamespacesApiResponse,
  generatedTimeIntervalsApi,
} from '../openapi/timeIntervalsApi.gen';

type Definitions = DefinitionsFromApi<typeof generatedTimeIntervalsApi>;
type UpdatedDefinitions = Omit<Definitions, 'listTimeIntervalForAllNamespaces'> & {
  listTimeIntervalForAllNamespaces: OverrideResultType<
    Definitions['listTimeIntervalForAllNamespaces'],
    Array<ListTimeIntervalForAllNamespacesApiResponse['items'][0]['spec']>
  >;
};

export const timeIntervalsApi = generatedTimeIntervalsApi.enhanceEndpoints<never, UpdatedDefinitions>({
  endpoints: {
    listTimeIntervalForAllNamespaces: {
      transformResponse: (response: ListTimeIntervalForAllNamespacesApiResponse) =>
        response.items.map((item) => item.spec),
    },
  },
});
