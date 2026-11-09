import { act, getWrapper, renderHook, waitFor } from 'test/test-utils';

import { useGetNameSpacesByDatasourceName, useGetRulerRules } from '../rule-editor/useAlertRuleSuggestions';

import { useNamespaceGroupOptions, useRulesToImport } from './hooks';

jest.mock('../rule-editor/useAlertRuleSuggestions', () => ({
  useGetRulerRules: jest.fn(),
  useGetNameSpacesByDatasourceName: jest.fn(),
}));

const mockSearch = jest.fn().mockResolvedValue({ view: { toArray: () => [] } });
jest.mock('app/features/search/service/searcher', () => ({
  getGrafanaSearcher: () => ({ search: mockSearch }),
}));

const wrapper = getWrapper({ renderWithRouter: true });

const alertRule = (alert: string, labels?: Record<string, string>) => ({ alert, expr: 'up == 0', labels });
const rulerRules = {
  'ns-a': [
    { name: 'group-a', rules: [alertRule('Kept'), alertRule('FromPlugin', { __grafana_origin: 'plugin/app' })] },
    { name: 'group-b', rules: [alertRule('OtherGroup')] },
  ],
  'ns-b': [{ name: 'group-c', rules: [alertRule('OtherNamespace')] }],
};

const rulesYaml = () =>
  new File(
    ['groups:\n  - name: yaml-group\n    rules:\n      - alert: FromYaml\n        expr: up == 0\n'],
    'rules.yaml'
  );

const baseArgs = {
  rulesSource: 'datasource' as const,
  rulesDatasourceName: 'Prometheus' as string | null,
  rulesYamlFile: null as File | null,
  namespace: undefined as string | undefined,
  ruleGroup: undefined as string | undefined,
  targetFolder: undefined,
};

// The rules file is read asynchronously even when there is none; let that settle inside act.
const settle = () => act(() => Promise.resolve());

beforeEach(() => {
  mockSearch.mockClear();
  jest.mocked(useGetRulerRules).mockReturnValue({ rulerRules, isLoading: false });
});

describe('useRulesToImport', () => {
  it('fetches the rules of the chosen data source and drops the ones an import cannot take', async () => {
    const { result } = renderHook(() => useRulesToImport(baseArgs), { wrapper });
    await settle();

    expect(useGetRulerRules).toHaveBeenCalledWith('Prometheus');
    expect(Object.keys(result.current.rulesToBeImported)).toEqual(['ns-a', 'ns-b']);
    expect(result.current.rulesToBeImported['ns-a'].flatMap((group) => group.rules)).toHaveLength(2);
    expect(result.current.someRulesAreSkipped).toBe(true);
  });

  it('narrows the rules to the chosen namespace and group', async () => {
    const { result } = renderHook(() => useRulesToImport({ ...baseArgs, namespace: 'ns-a', ruleGroup: 'group-a' }), {
      wrapper,
    });
    await settle();

    expect(Object.keys(result.current.rulesToBeImported)).toEqual(['ns-a']);
    expect(result.current.rulesToBeImported['ns-a'].map((group) => group.name)).toEqual(['group-a']);
  });

  it('reads a rules file instead, without fetching a data source', async () => {
    const rulesYamlFile = rulesYaml();
    const { result } = renderHook(() => useRulesToImport({ ...baseArgs, rulesSource: 'yaml', rulesYamlFile }), {
      wrapper,
    });

    await waitFor(() => expect(Object.keys(result.current.rulesToBeImported)).not.toHaveLength(0));
    expect(Object.values(result.current.rulesToBeImported)[0][0].name).toBe('yaml-group');
    expect(result.current.someRulesAreSkipped).toBe(false);
    expect(useGetRulerRules).toHaveBeenCalledWith(undefined);
  });

  it('imports nothing, and does not throw, for a rules file that cannot be read', async () => {
    const broken = new File(['groups: [not: valid'], 'broken.yaml');
    const { result } = renderHook(() => useRulesToImport({ ...baseArgs, rulesSource: 'yaml', rulesYamlFile: broken }), {
      wrapper,
    });

    // useAsync turns the failed parse into its error state; the step reports the parse error itself.
    await waitFor(() => expect(result.current.rulesToBeImported).toEqual({}));
  });

  it('ignores a leftover rules file while the source is a data source', async () => {
    const rulesYamlFile = rulesYaml();
    const { result } = renderHook(() => useRulesToImport({ ...baseArgs, rulesYamlFile }), { wrapper });
    await settle();

    expect(Object.keys(result.current.rulesToBeImported)).toEqual(['ns-a', 'ns-b']);
  });

  it('does not look for rules to overwrite until a target folder is chosen', async () => {
    const { result } = renderHook(() => useRulesToImport(baseArgs), { wrapper });
    await settle();

    expect(result.current.rulesThatMightBeOverwritten).toEqual({});
    expect(mockSearch).not.toHaveBeenCalled();
  });
});

describe('useNamespaceGroupOptions', () => {
  beforeEach(() => {
    jest.mocked(useGetNameSpacesByDatasourceName).mockReturnValue({
      namespaceGroups: new Map([
        ['ns-a', ['group-a', 'group-b']],
        ['ns-b', ['group-c']],
      ]),
      promNamespaces: [],
      isLoading: false,
    });
  });

  it('offers every namespace of a data source, and no groups until one is chosen', () => {
    const { result } = renderHook(() => useNamespaceGroupOptions('datasource', 'Prometheus', undefined));

    expect(result.current.namespaceOptions).toEqual([
      { label: 'ns-a', value: 'ns-a' },
      { label: 'ns-b', value: 'ns-b' },
    ]);
    expect(result.current.groupOptions).toEqual([]);
  });

  it('offers the groups of the chosen namespace', () => {
    const { result } = renderHook(() => useNamespaceGroupOptions('datasource', 'Prometheus', 'ns-a'));

    expect(result.current.groupOptions).toEqual([
      { label: 'group-a', value: 'group-a' },
      { label: 'group-b', value: 'group-b' },
    ]);
  });

  it('offers no groups for a namespace the data source does not have', () => {
    const { result } = renderHook(() => useNamespaceGroupOptions('datasource', 'Prometheus', 'gone'));

    expect(result.current.groupOptions).toEqual([]);
  });

  it('only asks for namespaces while the source is a data source', () => {
    renderHook(() => useNamespaceGroupOptions('yaml', 'Prometheus', undefined));

    expect(useGetNameSpacesByDatasourceName).toHaveBeenCalledWith(undefined);
  });

  it('passes the loading state through', () => {
    jest
      .mocked(useGetNameSpacesByDatasourceName)
      .mockReturnValue({ namespaceGroups: new Map(), promNamespaces: [], isLoading: true });
    const { result } = renderHook(() => useNamespaceGroupOptions('datasource', 'Prometheus', undefined));

    expect(result.current.isLoadingNamespaces).toBe(true);
  });
});
