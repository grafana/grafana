import { dimensionVariable, labelsVariable, setupMockedDataSource } from './__mocks__/CloudWatchDataSource';
import { VariableQuery, VariableQueryType } from './types';
import { CloudWatchVariableSupport } from './variables';

const defaultQuery: VariableQuery = {
  queryType: VariableQueryType.Regions,
  namespace: 'foo',
  region: 'bar',
  metricName: '',
  dimensionKey: '',
  instanceID: '',
  attributeName: '',
  resourceType: '',
  refId: '',
};

const ds = setupMockedDataSource({ variables: [labelsVariable, dimensionVariable] });
ds.datasource.getRegions = jest.fn().mockResolvedValue([{ label: 'a', value: 'a' }]);
ds.datasource.getNamespaces = jest.fn().mockResolvedValue([{ label: 'b', value: 'b' }]);
ds.datasource.getMetrics = jest.fn().mockResolvedValue([{ label: 'c', value: 'c' }]);
ds.datasource.getDimensionKeys = jest.fn().mockResolvedValue([{ label: 'd', value: 'd' }]);
ds.datasource.describeAllLogGroups = jest.fn().mockResolvedValue(['a', 'b']);
const getDimensionValues = jest.fn().mockResolvedValue([{ label: 'e', value: 'e' }]);
const getEbsVolumeIds = jest.fn().mockResolvedValue([{ label: 'f', value: 'f' }]);
const getEc2InstanceAttribute = jest.fn().mockResolvedValue([{ label: 'g', value: 'g' }]);
const getResourceARNs = jest.fn().mockResolvedValue([{ label: 'h', value: 'h' }]);

const variables = new CloudWatchVariableSupport(ds.datasource);

describe('variables', () => {
  it('should run regions', async () => {
    const result = await variables.execute({ ...defaultQuery });
    expect(result).toEqual([{ text: 'a', value: 'a', expandable: true }]);
  });

  it('should run namespaces', async () => {
    const result = await variables.execute({ ...defaultQuery, queryType: VariableQueryType.Namespaces });
    expect(result).toEqual([{ text: 'b', value: 'b', expandable: true }]);
  });

  it('should run metrics', async () => {
    const result = await variables.execute({ ...defaultQuery, queryType: VariableQueryType.Metrics });
    expect(result).toEqual([{ text: 'c', value: 'c', expandable: true }]);
  });

  it('should run dimension keys', async () => {
    const result = await variables.execute({ ...defaultQuery, queryType: VariableQueryType.DimensionKeys });
    expect(result).toEqual([{ text: 'd', value: 'd', expandable: true }]);
  });

  describe('dimension values', () => {
    const query = {
      ...defaultQuery,
      queryType: VariableQueryType.DimensionValues,
      metricName: 'abc',
      dimensionKey: 'efg',
      dimensionFilters: { a: 'b' },
    };
    beforeEach(() => {
      ds.datasource.getDimensionValues = getDimensionValues;
      getDimensionValues.mockClear();
    });

    it('should not run if dimension key not set', async () => {
      const result = await variables.execute({ ...query, dimensionKey: '' });
      expect(getDimensionValues).not.toBeCalled();
      expect(result).toEqual([]);
    });

    it('should not run if metric name not set', async () => {
      const result = await variables.execute({ ...query, metricName: '' });
      expect(getDimensionValues).not.toBeCalled();
      expect(result).toEqual([]);
    });
    it('should run if values are set', async () => {
      const result = await variables.execute(query);
      expect(getDimensionValues).toBeCalledWith(
        query.region,
        query.namespace,
        query.metricName,
        query.dimensionKey,
        query.dimensionFilters
      );
      expect(result).toEqual([{ text: 'e', value: 'e', expandable: true }]);
    });
  });

  describe('EBS volume ids', () => {
    beforeEach(() => {
      ds.datasource.getEbsVolumeIds = getEbsVolumeIds;
      getEbsVolumeIds.mockClear();
    });

    it('should not run if instance id not set', async () => {
      const result = await variables.execute({ ...defaultQuery, queryType: VariableQueryType.EBSVolumeIDs });
      expect(getEbsVolumeIds).not.toBeCalled();
      expect(result).toEqual([]);
    });

    it('should run if instance id set', async () => {
      const result = await variables.execute({
        ...defaultQuery,
        queryType: VariableQueryType.EBSVolumeIDs,
        instanceID: 'foo',
      });
      expect(getEbsVolumeIds).toBeCalledWith(defaultQuery.region, 'foo');
      expect(result).toEqual([{ text: 'f', value: 'f', expandable: true }]);
    });
  });

  describe('EC2 instance attributes', () => {
    const query = {
      ...defaultQuery,
      queryType: VariableQueryType.EC2InstanceAttributes,
      attributeName: 'abc',
      ec2Filters: { a: ['b'] },
    };
    beforeEach(() => {
      ds.datasource.getEc2InstanceAttribute = getEc2InstanceAttribute;
      getEc2InstanceAttribute.mockClear();
    });

    it('should not run if instance id not set', async () => {
      const result = await variables.execute({ ...query, attributeName: '' });
      expect(getEc2InstanceAttribute).not.toBeCalled();
      expect(result).toEqual([]);
    });

    it('should run if instance id set', async () => {
      const result = await variables.execute(query);
      expect(getEc2InstanceAttribute).toBeCalledWith(query.region, query.attributeName, { a: ['b'] });
      expect(result).toEqual([{ text: 'g', value: 'g', expandable: true }]);
    });
  });

  describe('resource arns', () => {
    const query = {
      ...defaultQuery,
      queryType: VariableQueryType.ResourceArns,
      resourceType: 'abc',
      tags: { a: ['b'] },
    };
    beforeEach(() => {
      ds.datasource.getResourceARNs = getResourceARNs;
      getResourceARNs.mockClear();
    });

    it('should not run if instance id not set', async () => {
      const result = await variables.execute({ ...query, resourceType: '' });
      expect(getResourceARNs).not.toBeCalled();
      expect(result).toEqual([]);
    });

    it('should run if instance id set', async () => {
      const result = await variables.execute(query);
      expect(getResourceARNs).toBeCalledWith(query.region, query.resourceType, { a: ['b'] });
      expect(result).toEqual([{ text: 'h', value: 'h', expandable: true }]);
    });
  });

  it('should run statistics', async () => {
    const result = await variables.execute({ ...defaultQuery, queryType: VariableQueryType.Statistics });
    expect(result).toEqual([
      { text: 'Average', value: 'Average', expandable: true },
      { text: 'Maximum', value: 'Maximum', expandable: true },
      { text: 'Minimum', value: 'Minimum', expandable: true },
      { text: 'Sum', value: 'Sum', expandable: true },
      { text: 'SampleCount', value: 'SampleCount', expandable: true },
    ]);
  });

  describe('log groups', () => {
    it('should call describe log groups', async () => {
      const result = await variables.execute({ ...defaultQuery, queryType: VariableQueryType.LogGroups });
      expect(result).toEqual([
        { text: 'a', value: 'a', expandable: true },
        { text: 'b', value: 'b', expandable: true },
      ]);
    });
  });
});
