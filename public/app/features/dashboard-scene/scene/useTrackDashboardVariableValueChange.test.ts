import { act, renderHook } from '@testing-library/react';

import { reportInteraction } from '@grafana/runtime';
import { CustomVariable, SceneVariableSet } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { useTrackDashboardVariableValueChange } from './useTrackDashboardVariableValueChange';

jest.mock('@grafana/runtime', () => {
  const runtime = jest.requireActual('@grafana/runtime');
  return {
    ...runtime,
    reportInteraction: jest.fn(),
  };
});

const mockUseMediaQueryMinWidth = jest.fn();

jest.mock('app/core/hooks/useMediaQueryMinWidth', () => ({
  useMediaQueryMinWidth: () => mockUseMediaQueryMinWidth(),
}));

describe('useTrackDashboardVariableValueChange', () => {
  beforeEach(() => {
    jest.mocked(reportInteraction).mockClear();
    mockUseMediaQueryMinWidth.mockReturnValue(false);
    setTestFlags({ dashboardNewLayouts: true });
  });

  afterEach(() => {
    setTestFlags({});
  });

  it('should report interaction on mobile when user changes a variable', () => {
    const variable = new CustomVariable({
      name: 'query0',
      query: 'A,B',
      value: 'A',
      text: 'A',
    });
    const variableSet = new SceneVariableSet({ variables: [variable] });
    variableSet.activate();

    const { result } = renderHook(() => useTrackDashboardVariableValueChange(variable));

    act(() => {
      result.current.markUserInitiated();
    });

    act(() => {
      variable.changeValueTo('B', 'B', true);
    });

    expect(reportInteraction).toHaveBeenCalledWith('dashboards_variable_value_changed', {
      type: 'custom',
      isDynamicDashboard: true,
    });
  });

  it('should not report interaction on desktop', () => {
    mockUseMediaQueryMinWidth.mockReturnValue(true);

    const variable = new CustomVariable({
      name: 'query0',
      query: 'A,B',
      value: 'A',
      text: 'A',
    });
    const variableSet = new SceneVariableSet({ variables: [variable] });
    variableSet.activate();

    const { result } = renderHook(() => useTrackDashboardVariableValueChange(variable));

    act(() => {
      result.current.markUserInitiated();
      variable.changeValueTo('B', 'B', true);
    });

    expect(reportInteraction).not.toHaveBeenCalled();
  });

  it('should not report interaction without user interaction', () => {
    const variable = new CustomVariable({
      name: 'query0',
      query: 'A,B',
      value: 'A',
      text: 'A',
    });
    const variableSet = new SceneVariableSet({ variables: [variable] });
    variableSet.activate();

    renderHook(() => useTrackDashboardVariableValueChange(variable));

    act(() => {
      variable.changeValueTo('B', 'B', true);
    });

    expect(reportInteraction).not.toHaveBeenCalled();
  });
});
