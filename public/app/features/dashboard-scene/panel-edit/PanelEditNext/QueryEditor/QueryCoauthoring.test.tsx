import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  type DataQuery,
  type QueryEditorCoauthoringContextV1,
  type QueryEditorCoauthoringControllerV1,
} from '@grafana/data';

import { QueryCoauthoring } from './QueryCoauthoring';

const mockGenerate = jest.fn().mockResolvedValue(undefined);
const mockCancel = jest.fn();
const mockReset = jest.fn();
const mockIdentifySelection = jest.fn().mockResolvedValue(undefined);
const mockCancelIdentification = jest.fn();
const mockResetIdentification = jest.fn();
const mockOpenAssistant = jest.fn();
const mockPost = jest.fn();
const VIEWPORT_TEST_MARGIN = 8;
let mockIsGenerating = false;
let mockIsIdentifying = false;
let mockInlineAssistantHookCall = 0;
let mockAssistantAvailable = true;
let mockAssistantLoading = false;

jest.mock('@grafana/assistant', () => ({
  createTool: (
    invoke: (input: Record<string, unknown>) => Promise<string>,
    options: {
      name: string;
      validate: (input: Record<string, unknown>) => unknown;
    }
  ) => ({
    ...options,
    invoke: async (input: Record<string, unknown>) => invoke(options.validate(input) as Record<string, unknown>),
  }),
  openAssistant: (...args: unknown[]) => mockOpenAssistant(...args),
  useAssistant: () => ({
    isLoading: mockAssistantLoading,
    isAvailable: mockAssistantAvailable,
    openAssistant: mockAssistantAvailable ? mockOpenAssistant : undefined,
    closeAssistant: undefined,
    toggleAssistant: undefined,
  }),
  useInlineAssistant: () => {
    const isIdentificationHook = mockInlineAssistantHookCall++ % 2 === 0;
    return isIdentificationHook
      ? {
          generate: mockIdentifySelection,
          isGenerating: mockIsIdentifying,
          content: '',
          error: null,
          cancel: mockCancelIdentification,
          reset: mockResetIdentification,
        }
      : {
          generate: mockGenerate,
          isGenerating: mockIsGenerating,
          content: '',
          error: null,
          cancel: mockCancel,
          reset: mockReset,
        };
  },
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    post: (...args: unknown[]) => mockPost(...args),
  }),
}));

async function setup(
  anchorTop = 0,
  waitForPrompt = true,
  context: QueryEditorCoauthoringContextV1 = {
    revision: '1',
    query: 'rate(http_requests_total[5m])',
    focusRanges: [{ from: 0, to: 4 }],
    language: {
      id: 'promql',
      displayName: 'PromQL',
      guidance: [
        'Treat slash-separated label names as alternatives.',
        'For a counter breakdown, apply rate before aggregating.',
      ],
    },
    metadata: [
      {
        kind: 'metric',
        name: 'http_requests_total',
        attributes: { type: 'counter', help: 'Total HTTP requests.' },
      },
    ],
  }
) {
  const focus = jest.fn();
  const clearPreview = jest.fn();
  const stagePreview = jest.fn(
    (source: string): ReturnType<QueryEditorCoauthoringControllerV1['stageEditorDiff']> => ({
      status: 'staged',
      query: { refId: 'A', expr: source } as DataQuery,
      changes: [
        {
          id: 'change-1',
          focus: 'inside',
          original: 'rate',
          proposed: 'increase',
          kind: 'function',
        },
      ],
    })
  );
  const dismissInvocation = jest.fn();
  const onAccept = jest.fn(() => true);
  const onPreview = jest.fn(() => true);
  const onRevertPreview = jest.fn();
  const anchorElement = document.createElement('div');
  const controller: QueryEditorCoauthoringControllerV1 = {
    getSnapshot: () => ({ mode: 'session', revision: context.revision }),
    subscribe: () => () => undefined,
    getPortalTarget: () => anchorElement,
    reportSurfaceSize: jest.fn(),
    getQueryText: jest.fn(() => context.query),
    begin: jest.fn().mockResolvedValue(context),
    refreshContext: jest.fn().mockImplementation(() => controller.begin()),
    stageEditorDiff: stagePreview,
    clearEditorDiff: clearPreview,
    dismiss: dismissInvocation,
    focus,
  };
  jest.spyOn(anchorElement, 'getBoundingClientRect').mockReturnValue({
    top: anchorTop,
    bottom: anchorTop,
    left: 0,
    right: 0,
    width: 0,
    height: 0,
    x: 0,
    y: anchorTop,
    toJSON: () => undefined,
  });
  document.body.append(anchorElement);

  const result = render(
    <QueryCoauthoring
      controller={controller}
      datasourceType="prometheus"
      onAccept={onAccept}
      onPreview={onPreview}
      onRevertPreview={onRevertPreview}
      timeRange={{ from: 1_000, to: 2_000 }}
    />
  );
  if (waitForPrompt) {
    await screen.findByRole('textbox', { name: 'Describe a query change' });
  }

  return {
    anchorElement,
    capability: controller,
    controller,
    clearPreview,
    dismissInvocation,
    focus,
    onAccept,
    onPreview,
    onRevertPreview,
    stagePreview,
    user: userEvent.setup(),
    ...result,
  };
}

describe('QueryCoauthoring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPost.mockResolvedValue({ id: 'feedback-id' });
    mockIsGenerating = false;
    mockIsIdentifying = false;
    mockInlineAssistantHookCall = 0;
    mockAssistantAvailable = true;
    mockAssistantLoading = false;
  });

  it('shows the selected metric context using the Figma Looks like treatment', async () => {
    await setup();

    expect(await screen.findByText('Looks like: http_requests_total is a counter metric.')).toBeInTheDocument();
  });

  it('requests and renders a privacy-bounded semantic explanation of the focused query text', async () => {
    const { capability } = await setup();

    expect(mockIdentifySelection).toHaveBeenCalledTimes(1);
    const request = mockIdentifySelection.mock.calls[0][0];
    expect(request).toMatchObject({
      origin: 'grafana/panel-edit-next/query-coauthoring/identify',
      agentName: 'query-coauthor-intent',
      agentId: 'grafana.query.coauthor.identify.v1',
      prompt: 'Explain the focused part of this existing PromQL query.',
    });
    expect(request.systemPrompt).toContain(JSON.stringify(capability.getQueryText()));
    expect(request.systemPrompt).toContain('Focused text: ["rate"]');
    expect(request.systemPrompt).toContain('http_requests_total');
    expect(request.systemPrompt).not.toContain('dashboardTitle');

    act(() => request.onComplete('Looks like: Calculates the per-second request rate.'));

    expect(screen.getByText(/Calculates the per-second request rate\./)).toBeInTheDocument();
    expect(screen.getByText(/Looks like:/)).toBeInTheDocument();
  });

  it('requests a holistic explanation when the whole query is focused', async () => {
    const query = 'rate(http_requests_total[5m])';
    await setup(0, true, {
      revision: '1',
      query,
      focusRanges: [{ from: 0, to: query.length }],
      language: { id: 'promql', displayName: 'PromQL' },
      metadata: [{ kind: 'metric', name: 'http_requests_total', attributes: { type: 'counter' } }],
    });

    const request = mockIdentifySelection.mock.calls[0][0];
    expect(request.prompt).toBe('Explain this existing PromQL query as a whole.');
    expect(request.systemPrompt).toContain('Focus scope: whole query.');
    expect(request.systemPrompt).toContain('Explain how the complete query works as one expression.');

    act(() => request.onError());
    expect(screen.getByText(/The complete PromQL query is selected for coauthoring\./)).toBeInTheDocument();
  });

  it('uses the datasource-provided language and guidance without PromQL assumptions', async () => {
    await setup(0, true, {
      revision: '1',
      query: '{service_name="checkout"} |= "error"',
      focusRanges: [{ from: 0, to: 26 }],
      language: {
        id: 'logql',
        displayName: 'LogQL',
        guidance: ['Preserve the stream selector unless the user explicitly asks to change it.'],
      },
      metadata: [{ kind: 'stream label', name: 'service_name', attributes: { values: ['checkout'] } }],
    });

    const identificationRequest = mockIdentifySelection.mock.calls[0][0];
    expect(identificationRequest).toMatchObject({
      agentName: 'query-coauthor-intent',
      prompt: 'Explain the focused part of this existing LogQL query.',
    });
    expect(identificationRequest.systemPrompt).toContain('Query language: {"id":"logql"');
    expect(identificationRequest.systemPrompt).not.toContain('PromQL');

    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox'), 'Match timeout errors');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));

    const request = mockGenerate.mock.calls[0][0];
    expect(request.agentName).toBe('query-coauthor');
    expect(request.systemPrompt).toContain('You help LogQL novices');
    expect(request.systemPrompt).toContain('Preserve the stream selector');
    expect(request.systemPrompt).not.toContain('PromQL');
    expect(request.tools[0].description).toContain('current LogQL query');
  });

  it('allows prompt entry while identifying and ignores a late explanation after submission', async () => {
    mockIsIdentifying = true;
    const { user } = await setup();
    const identificationRequest = mockIdentifySelection.mock.calls[0][0];

    expect(screen.getByText('Identifying intent…')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Describe a query change' }), 'Use increase');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));

    expect(mockCancelIdentification).toHaveBeenCalled();
    expect(mockGenerate).toHaveBeenCalledTimes(1);

    act(() => identificationRequest.onComplete('This late explanation should be ignored.'));
    expect(screen.queryByText(/late explanation/i)).not.toBeInTheDocument();
  });

  it('shows an explicit dismissal path when Assistant is unavailable', async () => {
    mockAssistantAvailable = false;
    const { user, capability, dismissInvocation, focus } = await setup(0, false);

    expect(await screen.findByText('Assistant is not available')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Describe a query change' })).not.toBeInTheDocument();
    expect(capability.begin).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(dismissInvocation).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
  });

  it('sends the bounded datasource, time range, query, focus, and metric context', async () => {
    const { user, capability } = await setup();

    await user.type(screen.getByRole('textbox'), 'Show the total count instead');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));

    const request = mockGenerate.mock.calls[0][0];
    expect(request).toMatchObject({
      origin: 'grafana/panel-edit-next/query-coauthoring',
      agentName: 'query-coauthor',
      agentId: 'grafana.query.coauthor.v1',
      prompt: 'Show the total count instead',
    });
    expect(request.systemPrompt).toContain(JSON.stringify(capability.getQueryText()));
    expect(request.systemPrompt).toContain('Focused text: ["rate"]');
    expect(request.systemPrompt).toContain('http_requests_total');
    expect(request.systemPrompt).toContain('counter');
    expect(request.systemPrompt).toContain('Data source plugin type: "prometheus"');
    expect(request.systemPrompt).toContain('Panel time range in UTC milliseconds: {"from":1000,"to":2000}');
    expect(request.systemPrompt).toContain('Make only the requested change.');
    expect(request.systemPrompt).toContain('slash-separated label names');
    expect(request.systemPrompt).toContain(
      'Keep clarifications to one plain-text question, at most two sentences and 240 characters.'
    );
    expect(request.systemPrompt).not.toContain('dashboardTitle');
  });

  it('stages a validated proposal in the editor and applies it only after acceptance', async () => {
    const { user, stagePreview, onAccept, onPreview, onRevertPreview, clearPreview, dismissInvocation } = await setup();

    await user.type(screen.getByRole('textbox'), 'Use increase');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));

    const request = mockGenerate.mock.calls[0][0];
    await act(async () => {
      await request.tools[0].invoke({
        proposedQuery: 'increase(http_requests_total[5m])',
        why: ['Returns the increase over the selected range.'],
      });
      request.onComplete('');
    });

    expect(onAccept).not.toHaveBeenCalled();
    expect(stagePreview).toHaveBeenCalledWith('increase(http_requests_total[5m])');
    expect(onPreview).toHaveBeenCalledWith({ refId: 'A', expr: 'increase(http_requests_total[5m])' });
    expect(screen.getByText('Returns the increase over the selected range.')).toBeInTheDocument();
    expect(screen.getByText('increase')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Accept' }));

    expect(clearPreview).toHaveBeenCalled();
    expect(dismissInvocation).toHaveBeenCalled();
    expect(onAccept).toHaveBeenCalledWith({
      refId: 'A',
      expr: 'increase(http_requests_total[5m])',
    });
    expect(onRevertPreview).not.toHaveBeenCalled();
  });

  it('keeps the proposal open when the host cannot accept it', async () => {
    const { user, onAccept, dismissInvocation } = await setup();

    await user.type(screen.getByRole('textbox'), 'Use increase');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));
    const request = mockGenerate.mock.calls[0][0];
    await act(async () => {
      await request.tools[0].invoke({
        proposedQuery: 'increase(http_requests_total[5m])',
        why: ['Returns the increase over the selected range.'],
      });
      request.onComplete('');
    });
    onAccept.mockReturnValue(false);

    await user.click(screen.getByRole('button', { name: 'Accept' }));

    expect(screen.getByText(/could not be accepted/i)).toBeInTheDocument();
    expect(dismissInvocation).not.toHaveBeenCalled();
  });

  it('clears a staged editor diff when generation fails after the proposal tool runs', async () => {
    const { user, clearPreview, onPreview } = await setup();

    await user.type(screen.getByRole('textbox'), 'Use increase');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));
    const request = mockGenerate.mock.calls[0][0];
    await act(async () => {
      await request.tools[0].invoke({
        proposedQuery: 'increase(http_requests_total[5m])',
        why: ['Returns the increase over the selected range.'],
      });
    });
    const clearCalls = clearPreview.mock.calls.length;

    act(() => request.onError(new Error('request failed')));

    expect(clearPreview).toHaveBeenCalledTimes(clearCalls + 1);
    expect(onPreview).not.toHaveBeenCalled();
    expect(screen.getByText(/could not build a query proposal/i)).toBeInTheDocument();
  });

  it('keeps a running proposal when host callback identities change', async () => {
    const { user, capability, onAccept, onPreview, onRevertPreview, rerender } = await setup();

    await user.type(screen.getByRole('textbox'), 'Use increase');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));
    const request = mockGenerate.mock.calls[0][0];
    await act(async () => {
      await request.tools[0].invoke({
        proposedQuery: 'increase(http_requests_total[5m])',
        why: ['Returns the increase over the selected range.'],
      });
      request.onComplete('');
    });

    const nextRevertPreview = jest.fn();
    rerender(
      <QueryCoauthoring
        controller={capability}
        datasourceType="prometheus"
        onAccept={onAccept}
        onPreview={onPreview}
        onRevertPreview={nextRevertPreview}
        timeRange={{ from: 1_000, to: 2_000 }}
      />
    );

    expect(onRevertPreview).not.toHaveBeenCalled();
    expect(nextRevertPreview).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
  });

  it('reverts and re-runs the baseline query when a proposal is dismissed', async () => {
    const { user, onPreview, onRevertPreview } = await setup();

    await user.type(screen.getByRole('textbox'), 'Use increase');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));

    const request = mockGenerate.mock.calls[0][0];
    await act(async () => {
      await request.tools[0].invoke({
        proposedQuery: 'increase(http_requests_total[5m])',
        why: ['Returns the increase over the selected range.'],
      });
      request.onComplete('');
    });

    expect(onPreview).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onRevertPreview).toHaveBeenCalledTimes(1);
  });

  it('cancels an in-flight build and ignores a late proposal', async () => {
    const { user, capability, stagePreview, onAccept, onPreview, onRevertPreview, rerender } = await setup();

    await user.type(screen.getByRole('textbox'), 'Use increase');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));
    const request = mockGenerate.mock.calls[0][0];

    mockIsGenerating = true;
    rerender(
      <QueryCoauthoring
        controller={capability}
        datasourceType="prometheus"
        onAccept={onAccept}
        onPreview={onPreview}
        onRevertPreview={onRevertPreview}
        timeRange={{ from: 1_000, to: 2_000 }}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Stop' }));

    await act(async () => {
      await request.tools[0].invoke({
        proposedQuery: 'increase(http_requests_total[5m])',
        why: ['Returns the increase over the selected range.'],
      });
      request.onComplete('');
    });

    expect(mockCancel).toHaveBeenCalled();
    expect(stagePreview).not.toHaveBeenCalled();
    expect(onAccept).not.toHaveBeenCalled();
  });

  it('keeps the captured query focus visible while building', async () => {
    mockIsGenerating = true;

    await setup();

    expect(screen.getByText('Building query…')).toBeInTheDocument();
    expect(screen.getByLabelText('Query focus')).toHaveTextContent('FOCUS');
    expect(screen.getByLabelText('Query focus')).toHaveTextContent('rate');
    expect(screen.getByLabelText('Relevant query context')).toHaveTextContent('CONTEXT');
    expect(screen.getByLabelText('Relevant query context')).toHaveTextContent('http_requests_total');
    expect(screen.getByRole('textbox', { name: 'Describe a query change' })).toBeInTheDocument();
  });

  it('degrades safely when an independently released datasource omits metadata', async () => {
    mockIsGenerating = true;

    await setup(0, true, {
      revision: '1',
      query: 'rate(http_requests_total[5m])',
      focusRanges: [{ from: 0, to: 4 }],
      language: { id: 'promql', displayName: 'PromQL' },
      metadata: undefined,
    } as unknown as QueryEditorCoauthoringContextV1);

    expect(screen.getByText('Building query…')).toBeInTheDocument();
    expect(screen.getByLabelText('Relevant query context')).toHaveTextContent('PromQL');
  });

  it('constrains the popover to the viewport below its editor anchor', async () => {
    await setup(500);

    expect(screen.getByRole('dialog', { name: 'Query coauthor' })).toHaveStyle({
      maxHeight: `${window.innerHeight - 500 - VIEWPORT_TEST_MARGIN}px`,
    });
  });

  it('recalculates the viewport constraint when the editor anchor moves after its content changes', async () => {
    let notifyResize: VoidFunction | undefined;
    const resizeObserver: ResizeObserver = {
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    };
    const resizeObserverSpy = jest
      .spyOn(globalThis, 'ResizeObserver')
      .mockImplementation((callback: ResizeObserverCallback) => {
        notifyResize = () => callback([], resizeObserver);
        return resizeObserver;
      });
    const { anchorElement } = await setup(500);

    jest.mocked(anchorElement.getBoundingClientRect).mockReturnValue({
      top: 600,
      bottom: 600,
      left: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 600,
      toJSON: () => undefined,
    });
    act(() => notifyResize?.());

    expect(resizeObserver.observe).toHaveBeenCalledWith(anchorElement);
    expect(screen.getByRole('dialog', { name: 'Query coauthor' })).toHaveStyle({
      maxHeight: `${window.innerHeight - 600 - VIEWPORT_TEST_MARGIN}px`,
    });
    resizeObserverSpy.mockRestore();
  });

  it('discards a typed draft when closed', async () => {
    const { user, dismissInvocation } = await setup();

    await user.type(screen.getByRole('textbox', { name: 'Describe a query change' }), 'Use increase');
    const cancelCalls = mockCancel.mock.calls.length;
    const resetCalls = mockReset.mock.calls.length;
    await user.click(screen.getByRole('button', { name: 'Close coauthoring' }));

    expect(mockCancel).toHaveBeenCalledTimes(cancelCalls + 1);
    expect(mockReset).toHaveBeenCalledTimes(resetCalls + 1);
    expect(dismissInvocation).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Continue coauthoring' })).not.toBeInTheDocument();
  });

  it('keeps the interaction open when the background is clicked', async () => {
    const { user, dismissInvocation } = await setup();

    await user.click(document.body);

    expect(screen.getByRole('dialog', { name: 'Query coauthor' })).toBeInTheDocument();
    expect(dismissInvocation).not.toHaveBeenCalled();
  });

  it('reverts an active proposal when closed', async () => {
    const { user, clearPreview, dismissInvocation, onRevertPreview } = await setup();

    await user.type(screen.getByRole('textbox', { name: 'Describe a query change' }), 'Use increase');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));
    const request = mockGenerate.mock.calls[0][0];
    await act(async () => {
      await request.tools[0].invoke({
        proposedQuery: 'increase(http_requests_total[5m])',
        why: ['Returns the increase over the selected range.'],
      });
      request.onComplete('');
    });
    await user.click(screen.getByRole('button', { name: 'Close coauthoring' }));

    expect(clearPreview).toHaveBeenCalled();
    expect(onRevertPreview).toHaveBeenCalledTimes(1);
    expect(dismissInvocation).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Resume suggestion' })).not.toBeInTheDocument();
  });

  it('cancels an in-flight request when closed and ignores a late proposal', async () => {
    const { user, dismissInvocation, onPreview, stagePreview } = await setup();

    await user.type(screen.getByRole('textbox', { name: 'Describe a query change' }), 'Use increase');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));
    const request = mockGenerate.mock.calls[0][0];
    const cancelCalls = mockCancel.mock.calls.length;

    await user.click(screen.getByRole('button', { name: 'Close coauthoring' }));

    expect(mockCancel).toHaveBeenCalledTimes(cancelCalls + 1);
    expect(dismissInvocation).toHaveBeenCalledTimes(1);
    stagePreview.mockClear();
    onPreview.mockClear();

    await act(async () => {
      await request.tools[0].invoke({
        proposedQuery: 'increase(http_requests_total[5m])',
        why: ['Returns the increase over the selected range.'],
      });
      request.onComplete('');
    });

    expect(stagePreview).not.toHaveBeenCalled();
    expect(onPreview).not.toHaveBeenCalled();
  });

  it('rejects a proposal when the baseline query changes during generation', async () => {
    const { user, capability, stagePreview, clearPreview, onAccept, onPreview } = await setup();

    await user.type(screen.getByRole('textbox'), 'Use increase');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));

    const request = mockGenerate.mock.calls[0][0];
    await request.tools[0].invoke({
      proposedQuery: 'increase(http_requests_total[5m])',
      why: ['Returns the increase over the selected range.'],
    });
    jest.mocked(capability.getQueryText).mockReturnValue('rate(http_requests_total[10m])');

    act(() => request.onComplete(''));

    expect(screen.getByText(/query changed while assistant was working/i)).toBeInTheDocument();
    expect(stagePreview).toHaveBeenCalledTimes(1);
    expect(clearPreview).toHaveBeenCalled();
    expect(onPreview).not.toHaveBeenCalled();
    expect(onAccept).not.toHaveBeenCalled();
  });

  it('treats an empty completion without a terminal tool result as a request failure', async () => {
    const { user } = await setup();

    await user.type(screen.getByRole('textbox'), 'Use increase');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));

    act(() => mockGenerate.mock.calls[0][0].onComplete(''));

    expect(screen.getByText(/could not build a query proposal/i)).toBeInTheDocument();
  });

  it('returns invalid PromQL to the tool loop so Assistant can repair it', async () => {
    const { user, stagePreview } = await setup();
    stagePreview.mockReturnValueOnce({ status: 'rejected', reason: 'invalid' });

    await user.type(screen.getByRole('textbox'), 'Break this down by handler');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));

    const request = mockGenerate.mock.calls[0][0];
    await expect(
      request.tools[0].invoke({
        proposedQuery: 'rate(http_requests_total[5m]) by (handler)',
        why: ['Breaks the result down by handler.'],
      })
    ).rejects.toThrow(/invalid PromQL/i);

    await act(async () => {
      await request.tools[0].invoke({
        proposedQuery: 'sum by (handler) (rate(http_requests_total[5m]))',
        why: ['Breaks the request rate down by handler.'],
      });
      request.onComplete('');
    });

    expect(stagePreview).toHaveBeenCalledWith('sum by (handler) (rate(http_requests_total[5m]))');
    expect(screen.getByText('Breaks the request rate down by handler.')).toBeInTheDocument();
  });

  it('identifies an exhausted PromQL repair instead of showing a generic response error', async () => {
    const { user, stagePreview } = await setup();
    stagePreview.mockReturnValue({ status: 'rejected', reason: 'invalid' });

    await user.type(screen.getByRole('textbox'), 'Break this down by handler');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));

    const request = mockGenerate.mock.calls[0][0];
    await expect(
      request.tools[0].invoke({
        proposedQuery: 'rate(http_requests_total[5m]) by (handler)',
        why: ['Breaks the result down by handler.'],
      })
    ).rejects.toThrow(/invalid PromQL/i);
    act(() => request.onComplete(''));

    expect(screen.getByText(/could not produce valid PromQL after trying to repair/i)).toBeInTheDocument();
  });

  it('shows a plain-text clarification and lets the user answer it', async () => {
    const { user } = await setup();

    await user.type(screen.getByRole('textbox'), 'Break this down by route/handler');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));
    act(() => mockGenerate.mock.calls[0][0].onComplete('Should I group by handler, route, or both?'));

    expect(screen.getByText('Should I group by handler, route, or both?')).toBeInTheDocument();
    expect(screen.queryByText(/did not return a valid PromQL proposal/i)).not.toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: 'Add a detail' }), 'Use handler');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(mockGenerate).toHaveBeenCalledTimes(2);
    expect(mockGenerate.mock.calls[1][0].prompt).toBe('Use handler');
  });

  it('normalizes Markdown clarification output to compact plain text', async () => {
    const { user } = await setup();

    await user.type(screen.getByRole('textbox'), 'Make this less noisy');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));
    act(() =>
      mockGenerate.mock.calls[0][0].onComplete('Choose one:\n1. **Aggregate by `method`**\n2. **Filter traffic**')
    );

    expect(screen.getByText('Choose one: 1. Aggregate by method 2. Filter traffic')).toBeInTheDocument();
    expect(screen.queryByText(/\*\*|`/)).not.toBeInTheDocument();
  });

  it('keeps clarification response controls outside the scrollable message region', async () => {
    const { user } = await setup();

    await user.type(screen.getByRole('textbox'), 'Make this less noisy');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));
    act(() =>
      mockGenerate.mock.calls[0][0].onComplete(
        'Would you like to aggregate by method, filter specific traffic, or smooth the resulting series?'
      )
    );

    const message = screen.getByRole('region', { name: 'Clarification message' });
    expect(message).toHaveTextContent(/aggregate by method/);
    expect(within(message).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(message).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Add a detail' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('offers a bounded handoff when the request is too broad for one query', async () => {
    const { user } = await setup();

    await user.type(screen.getByRole('textbox'), 'Update all queries in this dashboard');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));

    const request = mockGenerate.mock.calls[0][0];
    await act(async () => {
      await request.tools[1].invoke({ reason: 'This change spans other queries.' });
      request.onComplete('');
    });

    expect(screen.getByText(/may need to span other data sources or queries/i)).toBeInTheDocument();
    expect(screen.getByText(/unsaved panel edits will not be lost/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continue with Assistant' }));
    expect(mockOpenAssistant).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: 'grafana/panel-edit-next/query-coauthoring',
        mode: 'dashboarding',
        autoSend: false,
      })
    );
  });

  it('continues a proposal in Assistant with a curated unsent draft', async () => {
    const { user } = await setup();

    await user.type(screen.getByRole('textbox'), 'Use increase');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));
    const request = mockGenerate.mock.calls[0][0];
    await act(async () => {
      await request.tools[0].invoke({
        proposedQuery: 'increase(http_requests_total[5m])',
        why: ['Returns the increase over the selected range.'],
      });
      request.onComplete('');
    });

    await user.click(screen.getByRole('button', { name: 'Continue in Assistant' }));

    expect(mockOpenAssistant).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: 'grafana/panel-edit-next/query-coauthoring',
        mode: 'dashboarding',
        autoSend: false,
        prompt: expect.stringContaining('Requested change: "Use increase"'),
      })
    );
    const handoffPrompt = mockOpenAssistant.mock.calls[0][0].prompt;
    expect(handoffPrompt).toContain('Current query: "rate(http_requests_total[5m])"');
    expect(handoffPrompt).toContain('Inline proposal: "increase(http_requests_total[5m])"');
    expect(handoffPrompt).toContain('Returns the increase over the selected range.');
  });

  it('submits privacy-bounded feedback for a query proposal', async () => {
    const { user } = await setup();

    await user.type(screen.getByRole('textbox'), 'Use increase');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));

    const request = mockGenerate.mock.calls[0][0];
    await act(async () => {
      await request.tools[0].invoke({
        proposedQuery: 'increase(http_requests_total[5m])',
        why: ['Returns the increase over the selected range.'],
      });
      request.onComplete('');
    });

    await user.click(screen.getByRole('button', { name: 'Helpful' }));
    expect(screen.getByRole('dialog', { name: 'What went well?' })).toBeInTheDocument();
    expect(screen.getByText(/feedback will be sent to the teams working on querying/i)).toBeInTheDocument();
    expect(screen.getByText(/your query, prompt, and assistant response are not included/i)).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Share feedback' }), 'The explanation was clear.');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(mockPost).toHaveBeenCalledWith('/api/plugins/grafana-assistant-app/resources/api/v1/feedback', {
      targetKind: 'query-coauthoring',
      targetId: 'grafana.query.coauthor.v1',
      rating: 1,
      comment: 'The explanation was clear.',
      metadata: { outcome: 'proposal' },
    });
  });

  it('cancels negative feedback without sending anything', async () => {
    const { user } = await setup();

    await user.type(screen.getByRole('textbox'), 'Use increase');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));

    const request = mockGenerate.mock.calls[0][0];
    await act(async () => {
      await request.tools[0].invoke({
        proposedQuery: 'increase(http_requests_total[5m])',
        why: ['Returns the increase over the selected range.'],
      });
      request.onComplete('');
    });

    await user.click(screen.getByRole('button', { name: 'Not helpful' }));
    expect(screen.getByRole('dialog', { name: 'What went wrong?' })).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Share feedback' }), 'The change was too broad.');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockPost).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'What went wrong?' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
  });

  it('closes feedback on Escape without propagating or dismissing the proposal', async () => {
    const { user, dismissInvocation } = await setup();

    await user.type(screen.getByRole('textbox'), 'Use increase');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));

    const request = mockGenerate.mock.calls[0][0];
    await act(async () => {
      await request.tools[0].invoke({
        proposedQuery: 'increase(http_requests_total[5m])',
        why: ['Returns the increase over the selected range.'],
      });
      request.onComplete('');
    });

    await user.click(screen.getByRole('button', { name: 'Helpful' }));
    const propagatedKeyDown = jest.fn();
    document.addEventListener('keydown', propagatedKeyDown);

    try {
      await user.keyboard('{Escape}');

      expect(screen.queryByRole('dialog', { name: 'What went well?' })).not.toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: 'Query coauthor' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
      expect(propagatedKeyDown).not.toHaveBeenCalled();
      expect(dismissInvocation).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('keydown', propagatedKeyDown);
    }
  });

  it('keeps Enter available for multiline feedback instead of accepting the proposal', async () => {
    const { user, onAccept, dismissInvocation } = await setup();

    await user.type(screen.getByRole('textbox'), 'Use increase');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));

    const request = mockGenerate.mock.calls[0][0];
    await act(async () => {
      await request.tools[0].invoke({
        proposedQuery: 'increase(http_requests_total[5m])',
        why: ['Returns the increase over the selected range.'],
      });
      request.onComplete('');
    });

    await user.click(screen.getByRole('button', { name: 'Not helpful' }));
    const feedbackInput = screen.getByRole('textbox', { name: 'Share feedback' });
    await user.type(feedbackInput, 'The grouping is wrong.{enter}I expected handler.');

    expect(feedbackInput).toHaveValue('The grouping is wrong.\nI expected handler.');
    expect(screen.getByRole('dialog', { name: 'What went wrong?' })).toBeInTheDocument();
    expect(onAccept).not.toHaveBeenCalled();
    expect(dismissInvocation).not.toHaveBeenCalled();
  });

  it('surfaces request errors with retry and dismissal paths', async () => {
    const { user, dismissInvocation } = await setup();

    await user.type(screen.getByRole('textbox'), 'Use increase');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));
    act(() => mockGenerate.mock.calls[0][0].onError(new Error('request failed')));

    expect(screen.getByText(/could not build a query proposal/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.queryByText(/could not build a query proposal/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Coauthor' }));
    act(() => mockGenerate.mock.calls[1][0].onError(new Error('request failed')));
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(dismissInvocation).toHaveBeenCalled();
  });

  it('does not overwrite a request error with a later empty completion', async () => {
    const { user } = await setup();

    await user.type(screen.getByRole('textbox'), 'Use increase');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));
    const request = mockGenerate.mock.calls[0][0];

    act(() => {
      request.onError(new Error('request failed'));
      request.onComplete('');
    });

    expect(screen.getByText(/could not build a query proposal/i)).toBeInTheDocument();
    expect(screen.queryByText(/returned no query proposal/i)).not.toBeInTheDocument();
  });

  it('discards a request error when closed', async () => {
    const { user, dismissInvocation } = await setup();

    await user.type(screen.getByRole('textbox'), 'Use increase');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));
    act(() => mockGenerate.mock.calls[0][0].onError(new Error('request failed')));

    await user.click(screen.getByRole('button', { name: 'Close coauthoring' }));
    expect(dismissInvocation).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Continue coauthoring' })).not.toBeInTheDocument();
  });

  it('discards on Escape', async () => {
    const { user, focus, onAccept, dismissInvocation } = await setup();
    const cancelCalls = mockCancel.mock.calls.length;
    const resetCalls = mockReset.mock.calls.length;

    await user.keyboard('{Escape}');

    expect(onAccept).not.toHaveBeenCalled();
    expect(mockCancel).toHaveBeenCalledTimes(cancelCalls + 1);
    expect(mockReset).toHaveBeenCalledTimes(resetCalls + 1);
    expect(dismissInvocation).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Continue coauthoring' })).not.toBeInTheDocument();
  });
});
