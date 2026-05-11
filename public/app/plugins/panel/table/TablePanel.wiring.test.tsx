import { render } from '@testing-library/react';

import { DashboardCursorSync, FieldType, LoadingState, getDefaultTimeRange, toDataFrame } from '@grafana/data';
import { config } from '@grafana/runtime';
import { usePanelContext, useTheme2 } from '@grafana/ui';

import { getPanelProps } from '../test-utils';

import { TablePanel } from './TablePanel';
import { defaultOptions, type Options } from './panelcfg.gen';

const tableNGMock = jest.fn();

jest.mock('@grafana/ui/unstable', () => ({
  ...jest.requireActual('@grafana/ui/unstable'),
  TableNG: (props: unknown) => {
    tableNGMock(props);
    return null;
  },
}));

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  usePanelContext: jest.fn(),
  useTheme2: jest.fn(),
}));

describe('TablePanel onAddTransformation wiring', () => {
  const onAddAdHocTransformation = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useTheme2).mockReturnValue({
      spacing: { gridSize: 8 },
      components: { height: { md: 4 } },
    } as never);
    jest.mocked(usePanelContext).mockReturnValue({
      canExecuteActions: () => true,
      sync: () => DashboardCursorSync.Off,
      onAddAdHocFilter: jest.fn(),
      onAddAdHocTransformation,
    } as never);
  });

  it('passes panelContext.onAddAdHocTransformation when feature flag is enabled', () => {
    config.featureToggles.panelAdHocTransformations = true;

    renderTablePanel();

    expect(tableNGMock).toHaveBeenCalledTimes(1);
    expect(tableNGMock.mock.calls[0][0]).toEqual(
      expect.objectContaining({ onAddTransformation: onAddAdHocTransformation })
    );
  });

  it('passes undefined for onAddTransformation when feature flag is disabled', () => {
    config.featureToggles.panelAdHocTransformations = false;

    renderTablePanel();

    expect(tableNGMock).toHaveBeenCalledTimes(1);
    expect(tableNGMock.mock.calls[0][0]).toEqual(expect.objectContaining({ onAddTransformation: undefined }));
  });
});

function renderTablePanel() {
  const frame = toDataFrame({
    name: 'A',
    fields: [{ name: 'value', values: [1], type: FieldType.number }],
  });

  const options: Options = {
    ...defaultOptions,
    frameIndex: 0,
    showHeader: true,
  };

  const props = getPanelProps(options, {
    data: { state: LoadingState.Done, series: [frame], timeRange: getDefaultTimeRange() },
    fieldConfig: { defaults: {}, overrides: [] },
  });

  return render(<TablePanel {...props} />);
}
