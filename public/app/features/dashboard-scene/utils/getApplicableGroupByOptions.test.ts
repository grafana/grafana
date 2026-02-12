import { GroupByVariable, SceneDataQuery, VariableValueOption } from '@grafana/scenes';

import { getApplicableGroupByOptions } from './getApplicableGroupByOptions';

type GroupByVariableMock = {
  getGroupByApplicabilityForQueries: jest.MockedFunction<GroupByVariable['getGroupByApplicabilityForQueries']>;
};

const createGroupByVariableMock = (): GroupByVariableMock => ({
  getGroupByApplicabilityForQueries: jest.fn() as GroupByVariableMock['getGroupByApplicabilityForQueries'],
});

const asGroupByVariable = (mock: GroupByVariableMock): GroupByVariable => mock as unknown as GroupByVariable;

describe('getApplicableGroupByOptions', () => {
  it('returns empty array when options are empty', async () => {
    const groupByVariable = createGroupByVariableMock();
    const queries: SceneDataQuery[] = [{ refId: 'A' } as SceneDataQuery];

    const result = await getApplicableGroupByOptions(asGroupByVariable(groupByVariable), [], queries);

    expect(result).toEqual([]);
    expect(groupByVariable.getGroupByApplicabilityForQueries).not.toHaveBeenCalled();
  });

  it('returns options when queries are empty', async () => {
    const groupByVariable = createGroupByVariableMock();
    const options: VariableValueOption[] = [
      { label: 'Region', value: 'region' },
      { label: 'Instance', value: 'instance' },
    ];
    const result = await getApplicableGroupByOptions(asGroupByVariable(groupByVariable), options, []);

    expect(result).toBe(options);
    expect(groupByVariable.getGroupByApplicabilityForQueries).not.toHaveBeenCalled();
  });

  it('filters options using applicability response', async () => {
    const groupByVariable = createGroupByVariableMock();
    const queries: SceneDataQuery[] = [{ refId: 'A' } as SceneDataQuery];
    const options: VariableValueOption[] = [
      { label: 'Region', value: 'region' },
      { label: 'Instance', value: 'instance' },
    ];

    groupByVariable.getGroupByApplicabilityForQueries.mockResolvedValue([
      { key: 'region', applicable: true },
      { key: 'instance', applicable: false },
    ]);

    const result = await getApplicableGroupByOptions(asGroupByVariable(groupByVariable), options, queries);

    expect(groupByVariable.getGroupByApplicabilityForQueries).toHaveBeenCalledWith(['region', 'instance'], queries);
    expect(result).toEqual([{ label: 'region', value: 'region' }]);
  });

  it('returns original options when applicability is empty', async () => {
    const groupByVariable = createGroupByVariableMock();
    const queries: SceneDataQuery[] = [{ refId: 'A' } as SceneDataQuery];
    const options: VariableValueOption[] = [
      { label: 'Region', value: 'region' },
      { label: 'Instance', value: 'instance' },
    ];

    groupByVariable.getGroupByApplicabilityForQueries.mockResolvedValue([]);

    const result = await getApplicableGroupByOptions(asGroupByVariable(groupByVariable), options, queries);

    expect(result).toBe(options);
  });

  it('returns original options when applicability is undefined', async () => {
    const groupByVariable = createGroupByVariableMock();
    const queries: SceneDataQuery[] = [{ refId: 'A' } as SceneDataQuery];
    const options: VariableValueOption[] = [
      { label: 'Region', value: 'region' },
      { label: 'Instance', value: 'instance' },
    ];

    groupByVariable.getGroupByApplicabilityForQueries.mockResolvedValue(undefined);

    const result = await getApplicableGroupByOptions(asGroupByVariable(groupByVariable), options, queries);

    expect(result).toBe(options);
  });
});
