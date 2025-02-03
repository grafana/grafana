import { BASE_URL } from './api';
import { getIdentityDisplayList } from './testdata/identityDisplayList';
import { getTestQueryList } from './testdata/testQueryList';

export const mockData = {
  all: {
    url: BASE_URL,
    response: getTestQueryList(),
  },
  identityDisplay: {
    response: getIdentityDisplayList(),
  },
};
