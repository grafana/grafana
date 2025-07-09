import { ReceiversStateDTO } from 'app/types/alerting';

import { contactPointsStateDtoToModel, getIntegrationType, parseIntegrationName } from './grafana';

describe('parseIntegrationName method', () => {
  it('should return the integration name and index string when it is a valid type name with [{number}] ', () => {
    const { type, index } = parseIntegrationName('coolIntegration[1]');
    expect(type).toBe('coolIntegration');
    expect(index).toBe('[1]');
  });
  it('should return the integration name when it is a valid type name without [{number}] ', () => {
    const { type, index } = parseIntegrationName('coolIntegration');
    expect(type).toBe('coolIntegration');
    expect(index).toBe(undefined);
  });
  it('should return name as it is and index as undefined when it is a invalid index format ', () => {
    const { type, index } = parseIntegrationName('coolIntegration[345vadkfjgh');
    expect(type).toBe('coolIntegration[345vadkfjgh');
    expect(index).toBe(undefined);
  });
});

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
  it('should return name as it is when it is a invalid index format ', () => {
    const name = getIntegrationType('coolIntegration[345vadkfjgh');
    expect(name).toBe('coolIntegration[345vadkfjgh');
  });
});

describe('contactPointsStateDtoToModel method', () => {
  it('should return the expected object', () => {
    const response = [
      {
        active: true,
        integrations: [
          {
            lastNotifyAttemptError:
              'establish connection to server: dial tcp: lookup smtp.example.org on 8.8.8.8:53: no such host',
            lastNotifyAttempt: '2022-07-08 17:42:44.998893 +0000 UTC',
            lastNotifyAttemptDuration: '117.2455ms',
            name: 'email[0]',
          },
          {
            lastNotifyAttemptError:
              'establish connection to server: dial tcp: lookup smtp.example.org on 8.8.8.8:53: no such host',
            lastNotifyAttempt: '2022-07-08 17:42:44.998893 +0000 UTC',
            lastNotifyAttemptDuration: '117.2455ms',
            name: 'email[1]',
          },
          {
            lastNotifyAttempt: '2022-07-08 17:42:44.998893 +0000 UTC',
            lastNotifyAttemptDuration: '117.2455ms',
            name: 'email[2]',
          },
          {
            lastNotifyAttemptError:
              'establish connection to server: dial tcp: lookup smtp.example.org on 8.8.8.8:53: no such host',
            lastNotifyAttempt: '2022-07-08 17:42:44.998893 +0000 UTC',
            lastNotifyAttemptDuration: '117.2455ms',
            name: 'webhook[0]',
          },
        ],
        name: 'contact point 1',
      },
      {
        active: true,
        integrations: [
          {
            lastNotifyAttempt: '2022-07-08 17:42:44.998893 +0000 UTC',
            lastNotifyAttemptDuration: '117.2455ms',
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
          notifiers: {
            email: [
              {
                lastNotifyAttemptError:
                  'establish connection to server: dial tcp: lookup smtp.example.org on 8.8.8.8:53: no such host',
                lastNotifyAttempt: '2022-07-08 17:42:44.998893 +0000 UTC',
                lastNotifyAttemptDuration: '117.2455ms',
                name: 'email[0]',
              },
              {
                lastNotifyAttemptError:
                  'establish connection to server: dial tcp: lookup smtp.example.org on 8.8.8.8:53: no such host',
                lastNotifyAttempt: '2022-07-08 17:42:44.998893 +0000 UTC',
                lastNotifyAttemptDuration: '117.2455ms',
                name: 'email[1]',
              },
              {
                lastNotifyAttempt: '2022-07-08 17:42:44.998893 +0000 UTC',
                lastNotifyAttemptDuration: '117.2455ms',
                name: 'email[2]',
              },
            ],
            webhook: [
              {
                lastNotifyAttemptError:
                  'establish connection to server: dial tcp: lookup smtp.example.org on 8.8.8.8:53: no such host',
                lastNotifyAttempt: '2022-07-08 17:42:44.998893 +0000 UTC',
                lastNotifyAttemptDuration: '117.2455ms',
                name: 'webhook[0]',
              },
            ],
          },
        },
        'contact point 2': {
          active: true,
          errorCount: 0,
          notifiers: {
            email: [
              {
                lastNotifyAttempt: '2022-07-08 17:42:44.998893 +0000 UTC',
                lastNotifyAttemptDuration: '117.2455ms',
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
