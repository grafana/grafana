import { ApiKey, OrgRole } from 'app/types';

export const getMultipleMockKeys = (numberOfKeys: number): ApiKey[] => {
  const keys: ApiKey[] = [];

  for (let i = 1; i <= numberOfKeys; i++) {
    keys.push({
      id: i,
      name: `test-${i}`,
      role: OrgRole.Viewer,
      secondsToLive: 100,
      expiration: '2019-06-04',
    });
  }

  return keys;
};

export const getMockKey = (): ApiKey => {
  return {
    id: 1,
    name: 'test',
    role: OrgRole.Admin,
    secondsToLive: 200,
    expiration: '2019-06-04',
  };
};
