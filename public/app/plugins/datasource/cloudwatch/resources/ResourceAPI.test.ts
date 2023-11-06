import { config } from '@grafana/runtime';

import { setupMockedResourcesAPI } from '../__mocks__/ResourcesAPI';

describe('ResourcesAPI', () => {
  describe('describeLogGroup', () => {
    it('replaces region correctly in the query', async () => {
      const { api, resourceRequestMock } = setupMockedResourcesAPI();
      await api.getLogGroups({ region: 'default' });
      expect(resourceRequestMock.mock.calls[0][1].region).toBe('us-west-1');

      await api.getLogGroups({ region: 'eu-east' });
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

      const { api } = setupMockedResourcesAPI({ response });
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

      const logGroups = await api.getLogGroups({ region: 'default' });

      expect(logGroups).toEqual(expectedLogGroups);
    });
  });

  describe('memoization', () => {
    it('should not initiate new api request in case a previous request had same args', async () => {
      const getMock = jest.fn();
      const { api, resourceRequestMock } = setupMockedResourcesAPI({ getMock });
      resourceRequestMock.mockResolvedValue([]);
      await Promise.all([
        api.getMetrics({ namespace: 'AWS/EC2', region: 'us-east-1' }),
        api.getMetrics({ namespace: 'AWS/EC2', region: 'us-east-1' }),
        api.getMetrics({ namespace: 'AWS/EC2', region: 'us-east-2' }),
        api.getMetrics({ namespace: 'AWS/EC2', region: 'us-east-2' }),
        api.getMetrics({ namespace: 'AWS/EC2', region: 'us-east-2' }),
      ]);
      expect(resourceRequestMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('should handle backend srv response mapping', () => {
    it('when getAllMetrics is called', async () => {
      const getMock = jest.fn().mockResolvedValue([
        {
          value: {
            namespace: 'AWS/EC2',
            name: 'CPUUtilization',
          },
        },
        {
          value: {
            namespace: 'AWS/Redshift',
            name: 'CPUPercentage',
          },
        },
      ]);
      const { api } = setupMockedResourcesAPI({ getMock });
      const allMetrics = await api.getAllMetrics({ region: 'us-east-2' });
      expect(allMetrics).toEqual([
        { metricName: 'CPUUtilization', namespace: 'AWS/EC2' },
        { metricName: 'CPUPercentage', namespace: 'AWS/Redshift' },
      ]);
    });

    it('when getMetrics', async () => {
      const getMock = jest.fn().mockResolvedValue([
        {
          value: {
            namespace: 'AWS/EC2',
            name: 'CPUUtilization',
          },
        },
        {
          value: {
            namespace: 'AWS/EC2',
            name: 'CPUPercentage',
          },
        },
      ]);
      const { api } = setupMockedResourcesAPI({ getMock });
      const allMetrics = await api.getMetrics({ region: 'us-east-2', namespace: 'AWS/EC2' });
      expect(allMetrics).toEqual([
        { label: 'CPUUtilization', value: 'CPUUtilization' },
        { label: 'CPUPercentage', value: 'CPUPercentage' },
      ]);
    });
  });

  const originalFeatureToggleValue = config.featureToggles.cloudwatchNewRegionsHandler;

  describe('getRegions', () => {
    afterEach(() => {
      config.featureToggles.cloudwatchNewRegionsHandler = originalFeatureToggleValue;
    });
    it('should return regions as an array of options when using legacy regions route', async () => {
      config.featureToggles.cloudwatchNewRegionsHandler = false;
      const response = Promise.resolve([
        {
          text: 'US East (Ohio)',
          value: 'us-east-2',
          label: 'US East (Ohio)',
        },
        {
          text: 'US East (N. Virginia)',
          value: 'us-east-1',
          label: 'US East (N. Virginia)',
        },
        {
          text: 'US West (N. California)',
          value: 'us-west-1',
          label: 'US West (N. California)',
        },
      ]);

      const { api } = setupMockedResourcesAPI({ response });
      const expectedRegions = [
        {
          text: 'default',
          value: 'default',
          label: 'default',
        },
        {
          text: 'US East (Ohio)',
          value: 'us-east-2',
          label: 'US East (Ohio)',
        },
        {
          text: 'US East (N. Virginia)',
          value: 'us-east-1',
          label: 'US East (N. Virginia)',
        },
        {
          text: 'US West (N. California)',
          value: 'us-west-1',
          label: 'US West (N. California)',
        },
      ];

      const regions = await api.getRegions();

      expect(regions).toEqual(expectedRegions);
    });

    it('should return regions as an array of options when using new regions route', async () => {
      config.featureToggles.cloudwatchNewRegionsHandler = true;
      const response = Promise.resolve([
        {
          value: {
            name: 'us-east-2',
          },
        },
        {
          value: {
            name: 'us-east-1',
          },
        },
        {
          value: {
            name: 'us-west-1',
          },
        },
      ]);

      const { api } = setupMockedResourcesAPI({ response });
      const expectedRegions = [
        {
          text: 'default',
          value: 'default',
          label: 'default',
        },
        {
          text: 'us-east-2',
          value: 'us-east-2',
          label: 'us-east-2',
        },
        {
          text: 'us-east-1',
          value: 'us-east-1',
          label: 'us-east-1',
        },
        {
          text: 'us-west-1',
          value: 'us-west-1',
          label: 'us-west-1',
        },
      ];

      const regions = await api.getRegions();

      expect(regions).toEqual(expectedRegions);
    });
  });
});
