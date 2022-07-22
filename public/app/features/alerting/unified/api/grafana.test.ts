import { ReceiversStateDTO } from 'app/types';

import { contactPointsStateDtoToModel, getIntegrationType, isValidIntegrationType } from './grafana';

describe('getIntegrationType method', () => {
  it('should return the integration name when it is a valid type name with [{number}] ', () => {
    const name = getIntegrationType('coolIntegration[1]');
    expect(name).toBe('coolIntegration');

    const name2 = getIntegrationType('coolIntegration[6767]');
    expect(name2).toBe('coolIntegration');
  });
  it('should return the integration name when it is a valid type name without [{number}] ', () => {
    const name = getIntegrationType('coolIntegration');
    expect(name).toBe('coolIntegration');
  });
  it('should return undefined when it is a invalid type name ', () => {
    const name = getIntegrationType('coolIntegration[345vadkfjgh');
    expect(name).toBe(undefined);
  });
});
describe('isValidIntegrationType method', () => {
  it('should return true when it is a name followed with [{number}] ', () => {
    const name = isValidIntegrationType('coolIntegration[1]');
    expect(name).toBe(true);
  });
  it('should return true when it is a name without [{number}] ', () => {
    const name = isValidIntegrationType('coolIntegration');
    expect(name).toBe(true);
  });
  it('should return false when it is a name followed with [{wrong index}] ', () => {
    const name = isValidIntegrationType('coolIntegration[1123sfsf]');
    expect(name).toBe(false);
  });
  it('should return false when it is a name followed with [{index} ', () => {
    const name = isValidIntegrationType('coolIntegration[11');
    expect(name).toBe(false);
  });
});

describe('contactPointsStateDtoToModel method', () => {
  it('should return the expected object', () => {
    const response = [
      {
        active: true,
        integrations: [
          {
            lastError: 'establish connection to server: dial tcp: lookup smtp.example.org on 8.8.8.8:53: no such host',
            lastNotify: '2022-07-08 17:42:44.998893 +0000 UTC',
            lastNotifyDuration: '117.2455ms',
            name: 'email[0]',
          },
          {
            lastError: 'establish connection to server: dial tcp: lookup smtp.example.org on 8.8.8.8:53: no such host',
            lastNotify: '2022-07-08 17:42:44.998893 +0000 UTC',
            lastNotifyDuration: '117.2455ms',
            name: 'email[1]',
          },
          {
            lastNotify: '2022-07-08 17:42:44.998893 +0000 UTC',
            lastNotifyDuration: '117.2455ms',
            name: 'email[2]',
          },
          {
            lastError: 'establish connection to server: dial tcp: lookup smtp.example.org on 8.8.8.8:53: no such host',
            lastNotify: '2022-07-08 17:42:44.998893 +0000 UTC',
            lastNotifyDuration: '117.2455ms',
            name: 'webhook[0]',
          },
        ],
        name: 'contact point 1',
      },
      {
        active: true,
        integrations: [
          {
            lastNotify: '2022-07-08 17:42:44.998893 +0000 UTC',
            lastNotifyDuration: '117.2455ms',
            name: 'email[0]',
          },
        ],
        name: 'contact point 2',
      },
    ];
    expect(contactPointsStateDtoToModel(response)).toStrictEqual({
      errorCount: 3,
      receivers: {
        'contact point 1': {
          active: true,
          errorCount: 3,
          integrations: {
            email: [
              {
                lastError:
                  'establish connection to server: dial tcp: lookup smtp.example.org on 8.8.8.8:53: no such host',
                lastNotify: '2022-07-08 17:42:44.998893 +0000 UTC',
                lastNotifyDuration: '117.2455ms',
                name: 'email[0]',
              },
              {
                lastError:
                  'establish connection to server: dial tcp: lookup smtp.example.org on 8.8.8.8:53: no such host',
                lastNotify: '2022-07-08 17:42:44.998893 +0000 UTC',
                lastNotifyDuration: '117.2455ms',
                name: 'email[1]',
              },
              {
                lastNotify: '2022-07-08 17:42:44.998893 +0000 UTC',
                lastNotifyDuration: '117.2455ms',
                name: 'email[2]',
              },
            ],
            webhook: [
              {
                lastError:
                  'establish connection to server: dial tcp: lookup smtp.example.org on 8.8.8.8:53: no such host',
                lastNotify: '2022-07-08 17:42:44.998893 +0000 UTC',
                lastNotifyDuration: '117.2455ms',
                name: 'webhook[0]',
              },
            ],
          },
        },
        'contact point 2': {
          active: true,
          errorCount: 0,
          integrations: {
            email: [
              {
                lastNotify: '2022-07-08 17:42:44.998893 +0000 UTC',
                lastNotifyDuration: '117.2455ms',
                name: 'email[0]',
              },
            ],
          },
        },
      },
    });
  });

  //this test will be updated depending on how BE response is implemented when there is no state available for this AM
  it('should return the expected object if response is an empty array (no state available for this AM)', () => {
    const response: ReceiversStateDTO[] = [];
    expect(contactPointsStateDtoToModel(response)).toStrictEqual({
      errorCount: 0,
      receivers: {},
    });
  });
});
