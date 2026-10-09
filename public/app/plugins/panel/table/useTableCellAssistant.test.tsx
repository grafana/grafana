import { OpenFeatureProvider } from '@openfeature/react-sdk';
import { renderHook } from '@testing-library/react';
import { type PropsWithChildren } from 'react';

import { createAssistantContextItem, useAssistant } from '@grafana/assistant';
import { createDataFrame, dateTime, FieldType } from '@grafana/data';
import { FlagKeys } from '@grafana/runtime/internal';
import { getTestFeatureFlagClient, setTestFlags } from '@grafana/test-utils/unstable';

import { useTableCellAssistant } from './useTableCellAssistant';

jest.mock('@grafana/assistant', () => ({
  ASSISTANT_PLUGIN_ID: 'grafana-assistant-app',
  useAssistant: jest.fn(),
  createAssistantContextItem: jest.fn((type, params) => ({ type, params })),
}));

const openAssistant = jest.fn();
function wrapper({ children }: PropsWithChildren) {
  return <OpenFeatureProvider client={getTestFeatureFlagClient()}>{children}</OpenFeatureProvider>;
}
const props = {
  id: 7,
  title: 'Requests',
  timeRange: { from: dateTime(0), to: dateTime(10000), raw: { from: 'now-1h', to: 'now' } },
  replaceVariables: (s: string) =>
    s.replace('${__dashboard.uid}', 'dashboard-1').replace('${__dashboard.title}', 'Overview'),
};

beforeEach(() => {
  jest.clearAllMocks();
  setTestFlags({ [FlagKeys.TableRefresh]: true, [FlagKeys.TableRefreshNewFeatures]: true });
  jest.mocked(useAssistant).mockReturnValue({
    isLoading: false,
    isAvailable: true,
    openAssistant,
    closeAssistant: undefined,
    toggleAssistant: undefined,
  });
});

afterEach(() => {
  setTestFlags({});
});

it('adds the targeted cell through the shared Assistant hook', () => {
  const frame = createDataFrame({ fields: [{ name: 'value', type: FieldType.number, values: [10, 42] }] });
  const { result } = renderHook(() => useTableCellAssistant(props), { wrapper });
  result.current!(frame, frame.fields[0], 1);
  expect(createAssistantContextItem).toHaveBeenCalledWith(
    'structured',
    expect.objectContaining({
      data: expect.objectContaining({ kind: 'table-cell', cell: { value: 42, displayValue: '42', rowIndex: 1 } }),
    })
  );
  expect(openAssistant).toHaveBeenCalledWith({
    origin: 'grafana/table-cell',
    autoSend: false,
    appendContext: true,
    chatId: undefined,
    context: [jest.mocked(createAssistantContextItem).mock.results[0].value],
  });
});

it.each([
  [false, false, true, false],
  [true, false, true, false],
  [false, true, true, false],
  [true, true, false, false],
  [true, true, true, true],
])('gates callback: refresh=%s newFeatures=%s available=%s', (refresh, newFeatures, available, expected) => {
  setTestFlags({ [FlagKeys.TableRefresh]: refresh, [FlagKeys.TableRefreshNewFeatures]: newFeatures });
  jest.mocked(useAssistant).mockReturnValue({
    isLoading: false,
    isAvailable: available,
    openAssistant,
    closeAssistant: undefined,
    toggleAssistant: undefined,
  });
  const { result } = renderHook(() => useTableCellAssistant(props), { wrapper });
  expect(typeof result.current).toBe(expected ? 'function' : 'undefined');
});
