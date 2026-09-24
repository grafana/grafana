import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createAssistantContextItem, useAssistant } from '@grafana/assistant';
import { createDataFrame, dateTime, FieldType, store, type TimeRange } from '@grafana/data';
import {
  EXTENSION_SIDEBAR_DOCKED_LOCAL_STORAGE_KEY,
  getComponentIdFromComponentMeta,
} from 'app/core/components/AppChrome/ExtensionSidebar/extensionSidebarUtils';
import { setFullscreenWorkspaceActive } from 'app/core/components/AppChrome/FullscreenWorkspace/fullscreenWorkspaceState';

import { AssistantTooltipButton } from './AssistantTooltipButton';
import { type AssistantTooltipContext } from './buildAssistantContext';

jest.mock('@grafana/assistant', () => ({
  ASSISTANT_PLUGIN_ID: 'grafana-assistant-app',
  useAssistant: jest.fn(),
  createAssistantContextItem: jest.fn((type, params) => ({ type, params })),
}));

const POINT_1_MS = Date.UTC(2026, 6, 24, 12, 0, 0);
const POINT_2_MS = Date.UTC(2026, 6, 24, 12, 1, 0);
const POINT_2_ISO = new Date(POINT_2_MS).toISOString();

const mockUseAssistant = jest.mocked(useAssistant);
const mockCreateContextItem = jest.mocked(createAssistantContextItem);

// The shared visibility check is hook-free, so drive the sources it actually reads rather than
// mocking hooks the component no longer calls.
function setSidebar(open: boolean, pluginId = 'grafana-assistant-app') {
  if (open) {
    store.set(EXTENSION_SIDEBAR_DOCKED_LOCAL_STORAGE_KEY, getComponentIdFromComponentMeta(pluginId, 'Assistant'));
  } else {
    store.delete(EXTENSION_SIDEBAR_DOCKED_LOCAL_STORAGE_KEY);
  }
}

function setFullscreenWorkspace(active: boolean) {
  setFullscreenWorkspaceActive(active);
}

function makeSeries() {
  const frame = createDataFrame({
    refId: 'A',
    fields: [
      { name: 'time', type: FieldType.time, values: [POINT_1_MS, POINT_2_MS] },
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
    setSidebar(false);
    setFullscreenWorkspace(false);
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
        xVal={POINT_2_MS}
      />
    );

    expect(screen.queryByRole('button', { name: /add to assistant/i })).not.toBeInTheDocument();
  });

  it('renders nothing when openAssistant is undefined', () => {
    mockUseAssistant.mockReturnValue({
      isLoading: false,
      isAvailable: true,
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
        xVal={POINT_2_MS}
      />
    );

    expect(screen.queryByRole('button', { name: /add to assistant/i })).not.toBeInTheDocument();
  });

  it('opens the assistant with a single data-point context pill (without auto-send) on click', async () => {
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
        xVal={POINT_2_MS}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /add to assistant/i }));

    expect(mockCreateContextItem).toHaveBeenCalledTimes(1);
    expect(mockCreateContextItem).toHaveBeenCalledWith(
      'structured',
      expect.objectContaining({
        data: expect.objectContaining({
          kind: 'viz-datapoint',
          point: expect.objectContaining({ value: 42, timestamp: POINT_2_ISO }),
          series: expect.objectContaining({
            name: 'cpu host-a',
            refId: 'A',
            labels: { instance: 'host-a' },
            stats: expect.objectContaining({ max: 42, min: 10 }),
          }),
          panel: expect.objectContaining({ panelId: 4, panelTitle: 'CPU usage' }),
        }),
      })
    );

    expect(openAssistant).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: 'grafana/panel-tooltip',
        autoSend: false,
        context: expect.arrayContaining([expect.anything()]),
      })
    );
  });

  it('starts a new chat (no chatId) when the assistant sidebar is closed', async () => {
    store.set('grafana-assistant-active-chat-id', 'stale-chat-id');
    setSidebar(false);

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
        xVal={POINT_2_MS}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /add to assistant/i }));

    expect(openAssistant).toHaveBeenCalledWith(expect.objectContaining({ appendContext: true, chatId: undefined }));

    store.delete('grafana-assistant-active-chat-id');
  });

  it('appends to the open chat when the assistant sidebar is open', async () => {
    store.set('grafana-assistant-active-chat-id', 'open-chat-id');
    setSidebar(true);

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
        xVal={POINT_2_MS}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /add to assistant/i }));

    expect(openAssistant).toHaveBeenCalledWith(
      expect.objectContaining({ appendContext: true, chatId: 'open-chat-id' })
    );

    store.delete('grafana-assistant-active-chat-id');
  });

  it('appends to the open chat when the fullscreen workspace is active and the sidebar is closed', async () => {
    store.set('grafana-assistant-active-chat-id', 'workspace-chat-id');
    setSidebar(false);
    setFullscreenWorkspace(true);

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
        xVal={POINT_2_MS}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /add to assistant/i }));

    expect(openAssistant).toHaveBeenCalledWith(
      expect.objectContaining({ appendContext: true, chatId: 'workspace-chat-id' })
    );

    store.delete('grafana-assistant-active-chat-id');
  });

  it('starts a new chat when the sidebar is open with a different plugin', async () => {
    store.set('grafana-assistant-active-chat-id', 'stale-chat-id');
    setSidebar(true, 'grafana-pathfinder-app');

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
        xVal={POINT_2_MS}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /add to assistant/i }));

    expect(openAssistant).toHaveBeenCalledWith(expect.objectContaining({ chatId: undefined }));

    store.delete('grafana-assistant-active-chat-id');
  });
});
