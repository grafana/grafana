import { getAPIBaseURL } from '../../../../api/utils';

import { getIdentityDisplayList } from './testdata/identityDisplayList';
import { getTestQueryList } from './testdata/testQueryList';

// This is not ideal but not sure how to fix it right now as this is duplicated from the API definition which is in
// Enterprise and so we cannot import it here.
// We have some tests for testing QL inside Explore. The whole Explore setup is in OSS, and it needs these mocks but the
// test itself is in Enterprise. Ideally we would inject the mocks in the tests somehow.
export const BASE_URL = getAPIBaseURL('queries.grafana.app', 'v1beta1');

export const mockData = {
  all: {
    url: BASE_URL,
    response: getTestQueryList(),
  },
  identityDisplay: {
    response: getIdentityDisplayList(),
  },
};
