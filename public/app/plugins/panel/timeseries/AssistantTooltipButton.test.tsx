import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createAssistantContextItem, useAssistant } from '@grafana/assistant';
import { createDataFrame, dateTime, FieldType, type TimeRange } from '@grafana/data';

import { AssistantTooltipButton } from './AssistantTooltipButton';
import { type AssistantTooltipContext } from './buildAssistantContext';

jest.mock('@grafana/assistant', () => ({
  useAssistant: jest.fn(),
  createAssistantContextItem: jest.fn((type, params) => ({ type, params })),
}));

const mockUseAssistant = useAssistant as jest.MockedFunction<typeof useAssistant>;
const mockCreateContextItem = createAssistantContextItem as jest.MockedFunction<typeof createAssistantContextItem>;

function makeSeries() {
  const frame = createDataFrame({
    refId: 'A',
    fields: [
      { name: 'time', type: FieldType.time, values: [1000, 2000] },
      {
        name: 'cpu',
        type: FieldType.number,
        values: [10, 42],
        labels: { instance: 'host-a' },
        config: { unit: 'percent' },
      },
    ],
  });
  // display fns are normally attached by applyFieldOverrides; stub them for the test.
  frame.fields.forEach((f) => {
    f.display = (v) => ({ text: String(v), numeric: Number(v) });
  });
  return frame;
}

function makeContext(): AssistantTooltipContext {
  const range: TimeRange = {
    from: dateTime(0),
    to: dateTime(10000),
    raw: { from: 'now-1h', to: 'now' },
  };
  return {
    panelId: 4,
    panelTitle: 'CPU usage',
    timeRange: range,
    dataSeries: [makeSeries()],
    annotations: [],
  };
}

describe('AssistantTooltipButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when the assistant is unavailable', () => {
    mockUseAssistant.mockReturnValue({
      isLoading: false,
      isAvailable: false,
      openAssistant: undefined,
      closeAssistant: undefined,
      toggleAssistant: undefined,
    });

    render(
      <AssistantTooltipButton
        series={makeSeries()}
        seriesIdx={1}
        dataIdxs={[1, 1]}
        replaceVariables={(s) => s}
        context={makeContext()}
      />
    );

    expect(screen.queryByRole('button', { name: /ask assistant/i })).not.toBeInTheDocument();
  });

  it('opens the assistant with point, series and panel pills (without auto-send) on click', async () => {
    const openAssistant = jest.fn();
    mockUseAssistant.mockReturnValue({
      isLoading: false,
      isAvailable: true,
      openAssistant,
      closeAssistant: jest.fn(),
      toggleAssistant: jest.fn(),
    });

    render(
      <AssistantTooltipButton
        series={makeSeries()}
        seriesIdx={1}
        dataIdxs={[1, 1]}
        replaceVariables={(s) => s}
        context={makeContext()}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /ask assistant/i }));

    const kinds = mockCreateContextItem.mock.calls.map(
      ([, params]) => (params as { data: { kind: string } }).data.kind
    );
    expect(kinds).toEqual(['timeseries-datapoint', 'timeseries-series', 'dashboard-panel']);

    // Point pill carries the exact hovered value.
    expect(mockCreateContextItem).toHaveBeenCalledWith(
      'structured',
      expect.objectContaining({
        data: expect.objectContaining({ kind: 'timeseries-datapoint', value: 42, labels: { instance: 'host-a' } }),
      })
    );

    // Series pill carries summary stats so aggregate questions ("max?") are unambiguous.
    expect(mockCreateContextItem).toHaveBeenCalledWith(
      'structured',
      expect.objectContaining({
        data: expect.objectContaining({
          kind: 'timeseries-series',
          refId: 'A',
          stats: expect.objectContaining({ max: 42, min: 10 }),
        }),
      })
    );

    // Panel pill carries the panel/dashboard reference.
    expect(mockCreateContextItem).toHaveBeenCalledWith(
      'structured',
      expect.objectContaining({
        data: expect.objectContaining({ kind: 'dashboard-panel', panelId: 4, panelTitle: 'CPU usage' }),
      })
    );

    expect(openAssistant).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: 'grafana/panel-tooltip',
        autoSend: false,
        context: expect.arrayContaining([expect.anything(), expect.anything(), expect.anything()]),
      })
    );
  });
});
