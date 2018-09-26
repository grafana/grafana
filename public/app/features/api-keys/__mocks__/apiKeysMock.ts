import { ApiKey, OrgRole } from 'app/types';

export const getMultipleMockKeys = (numberOfKeys: number): ApiKey[] => {
  const keys: ApiKey[] = [];
  for (let i = 1; i <= numberOfKeys; i++) {
    keys.push({
      id: i,
      name: `test-${i}`,
      role: OrgRole.Viewer,
    });
  }

  return keys;
};

export const getMockKey = (): ApiKey => {
  return {
    id: 1,
    name: 'test',
    role: OrgRole.Admin,
  };
};
