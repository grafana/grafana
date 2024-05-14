import { BASE_URL } from './query';
import { getTestQueryList } from './testdata/testQueryList';

export const mockData = {
  all: {
    url: BASE_URL,
    response: getTestQueryList(),
  },
};
