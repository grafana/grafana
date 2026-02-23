import { renderHook } from '@testing-library/react';

import { AlertState } from '@grafana/data';
import { VizPanel } from '@grafana/scenes';
import { PromAlertingRuleState, PromRuleType } from 'app/types/unified-alerting-dto';

import { promAlertStateToAlertState } from '../../../../scene/AlertStatesDataLayer';
import { getDashboardSceneFor, getPanelIdForVizPanel } from '../../../../utils/utils';
import { PanelDataPaneNext } from '../../PanelDataPaneNext';

import { useAlertRulesForPanel } from './useAlertRulesForPanel';

// Mock dependencies
jest.mock('app/features/alerting/unified/hooks/usePanelCombinedRules');
jest.mock('../../../../scene/AlertStatesDataLayer');
jest.mock('../../../../utils/utils');

const mockUsePanelCombinedRules = jest.fn();
const mockGetDashboardSceneFor = getDashboardSceneFor as jest.MockedFunction<typeof getDashboardSceneFor>;
const mockGetPanelIdForVizPanel = getPanelIdForVizPanel as jest.MockedFunction<typeof getPanelIdForVizPanel>;
const mockPromAlertStateToAlertState = promAlertStateToAlertState as jest.MockedFunction<
  typeof promAlertStateToAlertState
>;

jest.mock('app/features/alerting/unified/hooks/usePanelCombinedRules', () => ({
  usePanelCombinedRules: () => mockUsePanelCombinedRules(),
}));

// Helper to create a minimal mock CombinedRule for testing
function createMockRule(uid: string, state: PromAlertingRuleState, type: PromRuleType = PromRuleType.Alerting) {
  return {
    uid,
    name: `Rule ${uid}`,
    query: 'up == 0',
    labels: {},
    annotations: {},
    promRule:
      type === PromRuleType.Alerting
        ? { type, state, health: 'ok', name: `Rule ${uid}`, query: 'up == 0' }
        : { type, health: 'ok', name: `Rule ${uid}`, query: 'up' },
    group: { name: 'Test Group', rules: [], totals: {} },
    namespace: { name: 'Test Namespace', groups: [], rulesSource: 'grafana' },
    instanceTotals: {},
    filteredInstanceTotals: {},
  };
}

interface SetupOptions {
  dashboardUID?: string;
  panelId?: number;
  rules?: Array<ReturnType<typeof createMockRule>>;
  loading?: boolean;
}

function setup(overrides?: SetupOptions) {
  const dashboardUID = overrides?.dashboardUID ?? 'dashboard-123';
  const panelId = overrides?.panelId ?? 42;
  const rules = overrides?.rules ?? [];
  const loading = overrides?.loading ?? false;

  mockGetDashboardSceneFor.mockReturnValue({ state: { uid: dashboardUID } } as ReturnType<typeof getDashboardSceneFor>);
  mockGetPanelIdForVizPanel.mockReturnValue(panelId);
  mockUsePanelCombinedRules.mockReturnValue({ rules, loading });
  mockPromAlertStateToAlertState.mockImplementation((state: PromAlertingRuleState) => {
    const map: Record<PromAlertingRuleState, AlertState> = {
      [PromAlertingRuleState.Firing]: AlertState.Alerting,
      [PromAlertingRuleState.Pending]: AlertState.Pending,
      [PromAlertingRuleState.Inactive]: AlertState.OK,
      [PromAlertingRuleState.Recovering]: AlertState.OK,
      [PromAlertingRuleState.Unknown]: AlertState.OK,
    };
    return map[state];
  });

  const dataPane = {} as PanelDataPaneNext;
  const panel = {} as VizPanel;

  return { dataPane, panel };
}

describe('useAlertRulesForPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return alert rules with converted states', () => {
    const { dataPane, panel } = setup({
      rules: [
        createMockRule('alert-1', PromAlertingRuleState.Firing),
        createMockRule('alert-2', PromAlertingRuleState.Pending),
      ],
    });

    const { result } = renderHook(() => useAlertRulesForPanel(dataPane, panel));

    expect(result.current.alertRules).toHaveLength(2);
    expect(result.current.alertRules[0].alertId).toBe('alert-1');
    expect(result.current.alertRules[0].state).toBe(AlertState.Alerting);
    expect(result.current.alertRules[1].alertId).toBe('alert-2');
    expect(result.current.alertRules[1].state).toBe(AlertState.Pending);
    expect(result.current.loading).toBe(false);
  });

  it('should handle loading state', () => {
    const { dataPane, panel } = setup({ loading: true });

    const { result } = renderHook(() => useAlertRulesForPanel(dataPane, panel));

    expect(result.current.loading).toBe(true);
    expect(result.current.alertRules).toEqual([]);
  });

  it('should handle empty rules', () => {
    const { dataPane, panel } = setup({ rules: [] });

    const { result } = renderHook(() => useAlertRulesForPanel(dataPane, panel));

    expect(result.current.alertRules).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('should extract dashboard UID and panel ID from scene graph', () => {
    const { dataPane, panel } = setup({ dashboardUID: 'test-dashboard', panelId: 99 });

    renderHook(() => useAlertRulesForPanel(dataPane, panel));

    expect(mockGetDashboardSceneFor).toHaveBeenCalledWith(dataPane);
    expect(mockGetPanelIdForVizPanel).toHaveBeenCalledWith(panel);
  });

  it('should handle undefined dashboard UID', () => {
    const { dataPane, panel } = setup({ dashboardUID: undefined });

    const { result } = renderHook(() => useAlertRulesForPanel(dataPane, panel));

    expect(result.current.alertRules).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('should convert alert states correctly', () => {
    const { dataPane, panel } = setup({
      rules: [
        createMockRule('alert-1', PromAlertingRuleState.Firing),
        createMockRule('alert-2', PromAlertingRuleState.Pending),
        createMockRule('alert-3', PromAlertingRuleState.Inactive),
      ],
    });

    const { result } = renderHook(() => useAlertRulesForPanel(dataPane, panel));

    expect(result.current.alertRules[0].state).toBe(AlertState.Alerting);
    expect(result.current.alertRules[1].state).toBe(AlertState.Pending);
    expect(result.current.alertRules[2].state).toBe(AlertState.OK);
  });

  it('should default to OK for recording rules', () => {
    const { dataPane, panel } = setup({
      rules: [createMockRule('rec-1', PromAlertingRuleState.Inactive, PromRuleType.Recording)],
    });

    const { result } = renderHook(() => useAlertRulesForPanel(dataPane, panel));

    expect(result.current.alertRules[0].state).toBe(AlertState.OK);
    expect(mockPromAlertStateToAlertState).not.toHaveBeenCalled();
  });

  it('should use rule UID as alertId', () => {
    const { dataPane, panel } = setup({
      rules: [createMockRule('custom-uid-123', PromAlertingRuleState.Firing)],
    });

    const { result } = renderHook(() => useAlertRulesForPanel(dataPane, panel));

    expect(result.current.alertRules[0].alertId).toBe('custom-uid-123');
  });

  it('should generate fallback alertId when UID is missing', () => {
    const ruleWithoutUID = createMockRule('', PromAlertingRuleState.Firing);
    // @ts-expect-error - Testing edge case where uid is undefined
    ruleWithoutUID.uid = undefined;
    const { dataPane, panel } = setup({ rules: [ruleWithoutUID] });

    const { result } = renderHook(() => useAlertRulesForPanel(dataPane, panel));

    expect(result.current.alertRules[0].alertId).toBe('alert-0');
  });

  it('should memoize result when dependencies do not change', () => {
    const rules = [createMockRule('alert-1', PromAlertingRuleState.Firing)];
    const { dataPane, panel } = setup({ rules });

    const { result, rerender } = renderHook(() => useAlertRulesForPanel(dataPane, panel));

    const firstResult = result.current;
    rerender();

    expect(result.current).toBe(firstResult);
  });

  it('should update when rules change', () => {
    const initialRules = [createMockRule('alert-1', PromAlertingRuleState.Firing)];
    const { dataPane, panel } = setup({ rules: initialRules });

    const { result, rerender } = renderHook(() => useAlertRulesForPanel(dataPane, panel));

    expect(result.current.alertRules).toHaveLength(1);

    // Change rules
    const updatedRules = [
      createMockRule('alert-1', PromAlertingRuleState.Firing),
      createMockRule('alert-2', PromAlertingRuleState.Pending),
    ];
    mockUsePanelCombinedRules.mockReturnValue({ rules: updatedRules, loading: false });

    rerender();

    expect(result.current.alertRules).toHaveLength(2);
  });

  it('should treat undefined loading as false', () => {
    const { dataPane, panel } = setup({ loading: undefined });

    const { result } = renderHook(() => useAlertRulesForPanel(dataPane, panel));

    expect(result.current.loading).toBe(false);
  });

  it('should preserve original rule object', () => {
    const rule = createMockRule('alert-1', PromAlertingRuleState.Firing);
    const { dataPane, panel } = setup({ rules: [rule] });

    const { result } = renderHook(() => useAlertRulesForPanel(dataPane, panel));

    expect(result.current.alertRules[0].rule).toBe(rule);
  });
});
