import { PanelProps, LoadingState, getDefaultTimeRange, FieldConfigSource } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';

/**
 * Get mock panel props for test purposes
 */
export const getPanelProps = <T>(
  defaultOptions: T,
  panelPropsOverrides?: Partial<Omit<PanelProps<T>, 'options'>>
): PanelProps<T> => {
  return {
    id: 1,
    data: { state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() },
    options: defaultOptions,
    eventBus: getAppEvents(),
    fieldConfig: {} as unknown as FieldConfigSource,
    height: 400,
    onChangeTimeRange: jest.fn(),
    onFieldConfigChange: jest.fn(),
    onOptionsChange: jest.fn(),
    replaceVariables: jest.fn(),
    renderCounter: 1,
    timeRange: getDefaultTimeRange(),
    timeZone: 'utc',
    title: 'DashList test title',
    transparent: false,
    width: 320,
    ...panelPropsOverrides,
  };
};
