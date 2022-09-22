import { setupMockedAPI } from './__mocks__/API';

describe('describeLogGroup', () => {
  it('replaces region correctly in the query', async () => {
    const { api, resourceRequestMock } = setupMockedAPI();
    await api.describeLogGroups({ region: 'default' });
    expect(resourceRequestMock.mock.calls[0][1].region).toBe('us-west-1');

    await api.describeLogGroups({ region: 'eu-east' });
    expect(resourceRequestMock.mock.calls[1][1].region).toBe('eu-east');
  });

  it('should return log groups as an array of options', async () => {
    const response = [
      {
        text: '/aws/containerinsights/dev303-workshop/application',
        value: '/aws/containerinsights/dev303-workshop/application',
        label: '/aws/containerinsights/dev303-workshop/application',
      },
      {
        text: '/aws/containerinsights/dev303-workshop/flowlogs',
        value: '/aws/containerinsights/dev303-workshop/flowlogs',
        label: '/aws/containerinsights/dev303-workshop/flowlogs',
      },
      {
        text: '/aws/containerinsights/dev303-workshop/dataplane',
        value: '/aws/containerinsights/dev303-workshop/dataplane',
        label: '/aws/containerinsights/dev303-workshop/dataplane',
      },
    ];

    const { api } = setupMockedAPI({ response });
    const expectedLogGroups = [
      {
        text: '/aws/containerinsights/dev303-workshop/application',
        value: '/aws/containerinsights/dev303-workshop/application',
        label: '/aws/containerinsights/dev303-workshop/application',
      },
      {
        text: '/aws/containerinsights/dev303-workshop/flowlogs',
        value: '/aws/containerinsights/dev303-workshop/flowlogs',
        label: '/aws/containerinsights/dev303-workshop/flowlogs',
      },
      {
        text: '/aws/containerinsights/dev303-workshop/dataplane',
        value: '/aws/containerinsights/dev303-workshop/dataplane',
        label: '/aws/containerinsights/dev303-workshop/dataplane',
      },
    ];

    const logGroups = await api.describeLogGroups({ region: 'default' });

    expect(logGroups).toEqual(expectedLogGroups);
  });
});
