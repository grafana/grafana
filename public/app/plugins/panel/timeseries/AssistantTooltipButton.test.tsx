import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createAssistantContextItem, useAssistant } from '@grafana/assistant';
import { createDataFrame, dateTime, FieldType, type TimeRange } from '@grafana/data';

import { AssistantTooltipButton } from './AssistantTooltipButton';
import { type AssistantTooltipContext } from './buildAssistantContext';
import { emitDatapointContextToParent, getDatapointEmbedTarget } from './emitDatapointContext';

jest.mock('@grafana/assistant', () => ({
  useAssistant: jest.fn(),
  createAssistantContextItem: jest.fn((type, params) => ({ type, params })),
}));

jest.mock('./emitDatapointContext', () => ({
  getDatapointEmbedTarget: jest.fn(),
  emitDatapointContextToParent: jest.fn(),
}));

const mockUseAssistant = useAssistant as jest.MockedFunction<typeof useAssistant>;
const mockCreateContextItem = createAssistantContextItem as jest.MockedFunction<typeof createAssistantContextItem>;
const mockGetEmbedTarget = getDatapointEmbedTarget as jest.MockedFunction<typeof getDatapointEmbedTarget>;
const mockEmitToParent = emitDatapointContextToParent as jest.MockedFunction<typeof emitDatapointContextToParent>;

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
    mockGetEmbedTarget.mockReturnValue(null);
    window.localStorage.clear();
  });

  it('renders nothing when the assistant is unavailable and not embedded', () => {
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
        chatId: undefined,
        context: expect.arrayContaining([expect.anything(), expect.anything(), expect.anything()]),
      })
    );
  });

  it('continues the active assistant conversation when one is open', async () => {
    const openAssistant = jest.fn();
    mockUseAssistant.mockReturnValue({
      isLoading: false,
      isAvailable: true,
      openAssistant,
      closeAssistant: jest.fn(),
      toggleAssistant: jest.fn(),
    });
    window.localStorage.setItem('grafana-assistant-active-chat-id', 'chat-123');

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

    expect(openAssistant).toHaveBeenCalledWith(expect.objectContaining({ chatId: 'chat-123', autoSend: false }));
  });

  it('posts the context to the embedding host (over the assistant) when embedded', async () => {
    const openAssistant = jest.fn();
    // Assistant is available, but the embed opt-in must take precedence.
    mockUseAssistant.mockReturnValue({
      isLoading: false,
      isAvailable: true,
      openAssistant,
      closeAssistant: jest.fn(),
      toggleAssistant: jest.fn(),
    });
    mockGetEmbedTarget.mockReturnValue('https://host.example');

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

    expect(openAssistant).not.toHaveBeenCalled();
    expect(mockCreateContextItem).not.toHaveBeenCalled();
    expect(mockEmitToParent).toHaveBeenCalledTimes(1);
    const [items, targetOrigin] = mockEmitToParent.mock.calls[0];
    expect(targetOrigin).toBe('https://host.example');
    expect(items.map((i) => (i.data as { kind: string }).kind)).toEqual([
      'timeseries-datapoint',
      'timeseries-series',
      'dashboard-panel',
    ]);
  });
});
