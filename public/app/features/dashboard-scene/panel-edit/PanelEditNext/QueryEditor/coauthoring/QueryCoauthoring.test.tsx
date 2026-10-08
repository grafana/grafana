import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { type DataQuery } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { QueryCoauthoring } from './QueryCoauthoring';
import {
  type QueryEditorCoauthoringAdapterV1,
  type QueryEditorCoauthoringContextV1,
} from './internalCoauthoringContract';

const mockGenerate = jest.fn().mockResolvedValue(undefined);
const mockCancel = jest.fn();
const mockReset = jest.fn();
const mockIdentifySelection = jest.fn().mockResolvedValue(undefined);
const mockCancelIdentification = jest.fn();
const mockResetIdentification = jest.fn();
const mockOpenAssistant = jest.fn();
const mockPost = jest.fn();
const mockReportInteraction = jest.fn();
const VIEWPORT_TEST_MARGIN = 8;
let mockIsGenerating = false;
let mockIsIdentifying = false;
let mockInlineAssistantHookCall = 0;
let mockAssistantAvailable = true;
let mockAssistantLoading = false;

jest.mock('@grafana/assistant', () => ({
  createAssistantContextItem: (type: string, params: Record<string, unknown>) => ({
    node: { data: { type, params, data: params.data } },
  }),
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
  reportInteraction: (...args: unknown[]) => mockReportInteraction(...args),
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
  },
  props: { isPreviewRunning?: boolean } = {}
) {
  const stagePreview = jest.fn(
    (_invocationId: string, source: string): ReturnType<QueryEditorCoauthoringAdapterV1['prepareProposal']> => ({
      status: 'ready',
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
  const onBaseline = jest.fn(() => true);
  const anchorElement = document.createElement('div');
  const baseline = { refId: 'A', expr: context.query } as DataQuery;
  const readInvocation = jest.fn().mockResolvedValue({ baseline, context });
  const adapter: QueryEditorCoauthoringAdapterV1 = {
    getSnapshot: () => ({ mode: 'invoked', invocationId: context.revision, portalTarget: anchorElement }),
    subscribe: () => () => undefined,
    invoke: jest.fn(),
    readInvocation,
    prepareProposal: stagePreview,
    dismiss: dismissInvocation,
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

  const queryCoauthoringProps = {
    adapter,
    invocationId: context.revision,
    portalTarget: anchorElement,
    datasourceType: 'prometheus',
    onBaseline,
    onAccept,
    onPreview,
    onRevertPreview,
    timeRange: { from: 1_000, to: 2_000 },
  };
  const result = render(<QueryCoauthoring {...queryCoauthoringProps} isPreviewRunning={props.isPreviewRunning} />);
  await act(async () => {
    await Promise.resolve();
  });
  if (waitForPrompt) {
    await screen.findByRole('textbox', { name: 'Describe a query change' });
  }

  return {
    anchorElement,
    capability: adapter,
    context,
    dismissInvocation,
    baseline,
    queryText: context.query,
    onAccept,
    onBaseline,
    onPreview,
    onRevertPreview,
    queryCoauthoringProps,
    readInvocation,
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

  it('shows the focused query summary using the highlighted query treatment', async () => {
    const { baseline, onBaseline } = await setup();

    expect(await screen.findByText('Highlighted query')).toBeInTheDocument();
    expect(screen.getByText('http_requests_total is a counter metric.')).toBeInTheDocument();
    expect(onBaseline).toHaveBeenCalledWith(baseline);
    expect(mockReportInteraction).toHaveBeenCalledWith('grafana_query_coauthoring_opened_popover', {
      datasource_type: 'prometheus',
    });
  });

  it('associates each concurrent session prompt with its own query summary', async () => {
    const firstTarget = document.createElement('div');
    const secondTarget = document.createElement('div');
    document.body.append(firstTarget, secondTarget);
    const makeSession = (invocationId: string, portalTarget: HTMLElement) => {
      const context: QueryEditorCoauthoringContextV1 = {
        revision: invocationId,
        query: 'rate(http_requests_total[5m])',
        focusRanges: [{ from: 0, to: 4 }],
        language: { id: 'promql', displayName: 'PromQL' },
        metadata: [],
      };
      const baseline = { refId: invocationId, expr: context.query } as DataQuery;
      const adapter: QueryEditorCoauthoringAdapterV1 = {
        getSnapshot: () => ({ mode: 'invoked', invocationId, portalTarget }),
        subscribe: () => () => undefined,
        invoke: jest.fn(),
        readInvocation: jest.fn().mockResolvedValue({ baseline, context }),
        prepareProposal: jest.fn(),
        dismiss: jest.fn(),
      };
      return (
        <QueryCoauthoring
          key={invocationId}
          adapter={adapter}
          invocationId={invocationId}
          portalTarget={portalTarget}
          datasourceType="prometheus"
          onBaseline={() => true}
          onAccept={() => true}
          onPreview={() => true}
          onRevertPreview={jest.fn()}
        />
      );
    };

    render(
      <>
        {makeSession('1', firstTarget)}
        {makeSession('2', secondTarget)}
      </>
    );
    await act(async () => {
      await Promise.resolve();
    });

    const firstPrompt = await within(firstTarget).findByRole('textbox', { name: 'Describe a query change' });
    const secondPrompt = await within(secondTarget).findByRole('textbox', { name: 'Describe a query change' });
    const firstSummary = within(firstTarget).getByText('The selection is part of this PromQL query.');
    const secondSummary = within(secondTarget).getByText('The selection is part of this PromQL query.');

    expect(firstSummary.id).not.toBe(secondSummary.id);
    expect(firstPrompt).toHaveAttribute('aria-describedby', firstSummary.id);
    expect(secondPrompt).toHaveAttribute('aria-describedby', secondSummary.id);
  });

  it('requests and renders a privacy-bounded semantic explanation of the focused query text', async () => {
    const { queryText } = await setup();

    expect(mockIdentifySelection).toHaveBeenCalledTimes(1);
    const request = mockIdentifySelection.mock.calls[0][0];
    expect(request).toMatchObject({
      origin: 'grafana/panel-edit-next/query-coauthoring/identify',
      agentName: 'query-coauthor-intent',
      agentId: 'grafana.query.coauthor.identify.v1',
      prompt: 'Explain the focused part of this existing PromQL query.',
    });
    expect(request.systemPrompt).toContain(JSON.stringify(queryText));
    expect(request.systemPrompt).toContain('Focused text: ["rate"]');
    expect(request.systemPrompt).toContain('http_requests_total');
    expect(request.systemPrompt).not.toContain('dashboardTitle');

    act(() => request.onComplete('Looks like: Calculates the per-second request rate.'));

    expect(screen.getByText(/Calculates the per-second request rate\./)).toBeInTheDocument();
    expect(screen.getByText('Highlighted query')).toBeInTheDocument();
  });

  it('does not regenerate the explanation when focus moves from the prompt to the explanation', async () => {
    const { user } = await setup();
    const identificationRequest = mockIdentifySelection.mock.calls[0][0];
    act(() => identificationRequest.onComplete('Calculates the per-second request rate.'));

    await user.click(screen.getByRole('textbox', { name: 'Describe a query change' }));
    await user.click(screen.getByText('Calculates the per-second request rate.'));

    expect(mockIdentifySelection).toHaveBeenCalledTimes(1);
  });

  it('does not regenerate the explanation when the host time range changes after context loads', async () => {
    const { queryCoauthoringProps, rerender } = await setup();
    const identificationRequest = mockIdentifySelection.mock.calls[0][0];
    act(() => identificationRequest.onComplete('Calculates the per-second request rate.'));

    rerender(<QueryCoauthoring {...queryCoauthoringProps} timeRange={{ from: 3_000, to: 4_000 }} />);

    expect(mockIdentifySelection).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Calculates the per-second request rate.')).toBeInTheDocument();
  });

  it('does not reload an invocation when baseline synchronization rerenders the row owner', async () => {
    const { queryCoauthoringProps, readInvocation, unmount } = await setup(0, false);

    function RowOwner() {
      const [baselineSyncCount, setBaselineSyncCount] = useState(0);

      return (
        <QueryCoauthoring
          {...queryCoauthoringProps}
          onBaseline={() => {
            if (baselineSyncCount === 0) {
              setBaselineSyncCount(1);
            }
            return true;
          }}
        />
      );
    }

    unmount();
    readInvocation.mockClear();
    mockIdentifySelection.mockClear();
    render(<RowOwner />);

    await screen.findByRole('textbox', { name: 'Describe a query change' });

    expect(readInvocation).toHaveBeenCalledTimes(1);
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

  it('shows an explicit dismissal path when Assistant is unavailable', async () => {
    mockAssistantAvailable = false;
    const { user, dismissInvocation, readInvocation } = await setup(0, false);

    expect(await screen.findByRole('alert')).toHaveTextContent('Assistant is not available');
    expect(screen.queryByRole('textbox', { name: 'Describe a query change' })).not.toBeInTheDocument();
    expect(readInvocation).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Close coauthoring' }));

    expect(dismissInvocation).toHaveBeenCalled();
  });

  it('keeps long proposal messages and changes in a bounded body with actions outside it', async () => {
    const { user, stagePreview } = await setup();
    stagePreview.mockReturnValue({
      status: 'ready',
      query: { refId: 'A', expr: 'sum by (handler) (rate(http_requests_total[5m]))' } as DataQuery,
      changes: Array.from({ length: 4 }, (_, index) => ({
        id: `change-${index}`,
        focus: 'inside',
        original: `original_expression_${index}`,
        proposed: `proposed_expression_${index}`,
        kind: 'expression',
      })),
    });

    await user.type(screen.getByRole('textbox'), 'Break down by handler');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));
    const request = mockGenerate.mock.calls[0][0];
    await act(async () => {
      await request.tools[0].invoke({
        proposedQuery: 'sum by (handler) (rate(http_requests_total[5m]))',
        why: Array.from({ length: 5 }, (_, index) => `Detailed explanation ${index} for the proposed query change.`),
      });
      request.onComplete('');
    });

    const details = screen.getByRole('region', { name: 'Query proposal details' });
    expect(details).toBe(screen.getByTestId(selectors.components.QueryEditorCoauthoring.container));
    expect(details.children[0]).toHaveStyle({ flex: '0 0 auto' });
    expect(details.children[1]).toHaveStyle({ flex: '0 0 auto' });
    expect(within(details).getAllByLabelText(/^Original expression$/)).toHaveLength(4);
    expect(within(details).getAllByLabelText(/^Proposed expression$/)).toHaveLength(4);
    expect(within(details).queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open in chat' })).toBeInTheDocument();
  });

  it('keeps the captured query focus visible while building', async () => {
    mockIsGenerating = true;

    await setup(0, false);

    expect(screen.getByRole('status')).toHaveTextContent('Building query...');
    expect(await screen.findByLabelText('Query focus')).toHaveTextContent('FOCUS');
    expect(screen.getByLabelText('Query focus')).toHaveTextContent('rate');
    expect(screen.getByLabelText('Relevant query context')).toHaveTextContent('CONTEXT');
    expect(screen.getByLabelText('Relevant query context')).toHaveTextContent('http_requests_total');
    expect(screen.queryByRole('textbox', { name: 'Describe a query change' })).not.toBeInTheDocument();
  });

  it('degrades safely when an independently released datasource omits metadata', async () => {
    mockIsGenerating = true;

    await setup(0, false, {
      revision: '1',
      query: 'rate(http_requests_total[5m])',
      focusRanges: [{ from: 0, to: 4 }],
      language: { id: 'promql', displayName: 'PromQL' },
      metadata: undefined,
    } as unknown as QueryEditorCoauthoringContextV1);

    expect(screen.getByText('Building query...')).toBeInTheDocument();
    expect(await screen.findByLabelText('Relevant query context')).toHaveTextContent('PromQL');
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

  it('does not resize a loaded explanation when its own scroll body is scrolled', async () => {
    const { anchorElement } = await setup(500);
    const dialog = screen.getByRole('dialog', { name: 'Query coauthor' });
    expect(dialog).toHaveStyle({ maxHeight: `${window.innerHeight - 500 - VIEWPORT_TEST_MARGIN}px` });

    jest.mocked(anchorElement.getBoundingClientRect).mockReturnValue({
      top: 440,
      bottom: 440,
      left: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 440,
      toJSON: () => undefined,
    });
    fireEvent.scroll(screen.getByTestId(selectors.components.QueryEditorCoauthoring.container));

    expect(dialog).toHaveStyle({ maxHeight: `${window.innerHeight - 500 - VIEWPORT_TEST_MARGIN}px` });
  });

  it('settles the loaded explanation height after Monaco relocates the surface', async () => {
    let notifyResize: VoidFunction | undefined;
    let nextAnimationFrameId = 1;
    const animationFrames = new Map<number, FrameRequestCallback>();
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
    const requestAnimationFrameSpy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      const id = nextAnimationFrameId++;
      animationFrames.set(id, callback);
      return id;
    });
    const cancelAnimationFrameSpy = jest
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation((id) => animationFrames.delete(id));
    const runOnlyAnimationFrame = (timestamp: number) => {
      expect(animationFrames.size).toBe(1);
      const [[id, callback]] = animationFrames;
      animationFrames.delete(id);
      act(() => callback(timestamp));
    };
    const drainInitialAnimationFrames = () => {
      while (animationFrames.size > 0) {
        const [[id, callback]] = animationFrames;
        animationFrames.delete(id);
        act(() => callback(0));
      }
    };

    try {
      const { anchorElement } = await setup(600);
      const dialog = screen.getByRole('dialog', { name: 'Query coauthor' });
      expect(animationFrames.size).toBe(2);
      drainInitialAnimationFrames();
      expect(animationFrames.size).toBe(0);

      act(() => notifyResize?.());
      expect(dialog).toHaveStyle({ maxHeight: `${window.innerHeight - 600 - VIEWPORT_TEST_MARGIN}px` });
      expect(animationFrames.size).toBe(1);

      runOnlyAnimationFrame(0);
      expect(dialog).toHaveStyle({ maxHeight: `${window.innerHeight - 600 - VIEWPORT_TEST_MARGIN}px` });
      expect(animationFrames.size).toBe(1);

      jest.mocked(anchorElement.getBoundingClientRect).mockReturnValue({
        top: 440,
        bottom: 440,
        left: 0,
        right: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 440,
        toJSON: () => undefined,
      });
      runOnlyAnimationFrame(16);

      expect(dialog).toHaveStyle({ maxHeight: `${window.innerHeight - 440 - VIEWPORT_TEST_MARGIN}px` });
      expect(animationFrames.size).toBe(0);
    } finally {
      resizeObserverSpy.mockRestore();
      requestAnimationFrameSpy.mockRestore();
      cancelAnimationFrameSpy.mockRestore();
    }
  });

  it('recalculates the viewport constraint for ancestor scrolling', async () => {
    const { anchorElement } = await setup(500);
    const dialog = screen.getByRole('dialog', { name: 'Query coauthor' });

    jest.mocked(anchorElement.getBoundingClientRect).mockReturnValue({
      top: 440,
      bottom: 440,
      left: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 440,
      toJSON: () => undefined,
    });
    fireEvent.scroll(document.body);

    expect(dialog).toHaveStyle({ maxHeight: `${window.innerHeight - 440 - VIEWPORT_TEST_MARGIN}px` });
  });

  it('discards a typed draft when closed', async () => {
    const { user, dismissInvocation } = await setup();

    await user.type(screen.getByRole('textbox', { name: 'Describe a query change' }), 'Use increase');
    const cancelCalls = mockCancel.mock.calls.length;
    const resetCalls = mockReset.mock.calls.length;
    const cancelIdentificationCalls = mockCancelIdentification.mock.calls.length;
    const resetIdentificationCalls = mockResetIdentification.mock.calls.length;
    await user.click(screen.getByRole('button', { name: 'Close coauthoring' }));

    expect(mockCancel).toHaveBeenCalledTimes(cancelCalls + 1);
    expect(mockReset).toHaveBeenCalledTimes(resetCalls + 1);
    expect(mockCancelIdentification).toHaveBeenCalledTimes(cancelIdentificationCalls + 2);
    expect(mockResetIdentification).toHaveBeenCalledTimes(resetIdentificationCalls + 1);
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
    const { user, dismissInvocation, onRevertPreview } = await setup();

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

  it('shows a plain-text clarification and lets the user answer it', async () => {
    const { user } = await setup();

    await user.type(screen.getByRole('textbox'), 'Break this down by route/handler');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));
    act(() => mockGenerate.mock.calls[0][0].onComplete('Should I group by handler, route, or both?'));

    expect(screen.getByText('Should I group by handler, route, or both?')).toBeInTheDocument();
    expect(screen.queryByText(/did not return a valid PromQL proposal/i)).not.toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: 'Add extra detail' }), 'Use handler');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(mockGenerate).toHaveBeenCalledTimes(2);
    expect(mockGenerate.mock.calls[1][0].prompt).toBe('Use handler');
  });

  it('remounts and focuses the clarification prompt after generation settles', async () => {
    let nextAnimationFrameId = 1;
    const animationFrames = new Map<number, FrameRequestCallback>();
    const requestAnimationFrameSpy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      const id = nextAnimationFrameId++;
      animationFrames.set(id, callback);
      return id;
    });
    const cancelAnimationFrameSpy = jest
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation((id) => animationFrames.delete(id));
    const drainAnimationFrames = () => {
      while (animationFrames.size > 0) {
        const [[id, callback]] = animationFrames;
        animationFrames.delete(id);
        act(() => callback(0));
      }
    };

    try {
      const { queryCoauthoringProps, rerender, user } = await setup();
      const initialPrompt = screen.getByRole('textbox', { name: 'Describe a query change' });
      const initialMessage = screen.getByText('http_requests_total is a counter metric.');
      drainAnimationFrames();
      expect(initialPrompt).toHaveFocus();
      expect(initialMessage).toHaveAttribute('id');
      expect(initialPrompt).toHaveAttribute('aria-describedby', initialMessage.id);

      await user.type(initialPrompt, 'Break this down by route/handler');
      await user.click(screen.getByRole('button', { name: 'Coauthor' }));
      const request = mockGenerate.mock.calls[0][0];

      mockIsGenerating = true;
      rerender(<QueryCoauthoring {...queryCoauthoringProps} />);
      expect(screen.getByRole('status')).toHaveTextContent('Building query...');

      mockIsGenerating = false;
      act(() => request.onComplete('Should I group by handler, route, or both?'));

      const clarificationMessage = screen.getByText('Should I group by handler, route, or both?');
      const clarificationPrompt = screen.getByRole('textbox', { name: 'Add extra detail' });
      expect(clarificationMessage).toHaveAttribute('id', initialMessage.id);
      expect(clarificationPrompt).toHaveAttribute('aria-describedby', clarificationMessage.id);

      drainAnimationFrames();

      expect(clarificationPrompt).toHaveFocus();

      await user.type(clarificationPrompt, 'Use handler');
      await user.click(screen.getByRole('button', { name: 'Continue' }));
      const secondRequest = mockGenerate.mock.calls[1][0];

      mockIsGenerating = true;
      rerender(<QueryCoauthoring {...queryCoauthoringProps} />);
      expect(screen.getByRole('status')).toHaveTextContent('Building query...');

      mockIsGenerating = false;
      act(() => secondRequest.onComplete('Would you also group by status code?'));

      const secondClarificationPrompt = screen.getByRole('textbox', { name: 'Add extra detail' });
      expect(secondClarificationPrompt).not.toBe(clarificationPrompt);

      drainAnimationFrames();

      expect(secondClarificationPrompt).toHaveFocus();
    } finally {
      mockIsGenerating = false;
      requestAnimationFrameSpy.mockRestore();
      cancelAnimationFrameSpy.mockRestore();
    }
  });

  it('keeps focus in the dialog while moving from the prompt through building to a proposal', async () => {
    let nextAnimationFrameId = 1;
    const animationFrames = new Map<number, FrameRequestCallback>();
    const requestAnimationFrameSpy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      const id = nextAnimationFrameId++;
      animationFrames.set(id, callback);
      return id;
    });
    const cancelAnimationFrameSpy = jest
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation((id) => animationFrames.delete(id));
    const drainAnimationFrames = () => {
      while (animationFrames.size > 0) {
        const [[id, callback]] = animationFrames;
        animationFrames.delete(id);
        act(() => callback(0));
      }
    };

    try {
      const { queryCoauthoringProps, rerender, stagePreview, user } = await setup();
      const prompt = screen.getByRole('textbox', { name: 'Describe a query change' });
      drainAnimationFrames();
      expect(prompt).toHaveFocus();

      await user.type(prompt, 'Use increase');
      await user.click(screen.getByRole('button', { name: 'Coauthor' }));
      const request = mockGenerate.mock.calls[0][0];

      mockIsGenerating = true;
      rerender(<QueryCoauthoring {...queryCoauthoringProps} />);
      drainAnimationFrames();

      const dialog = screen.getByRole('dialog', { name: 'Query coauthor' });
      expect(screen.getByRole('status')).toHaveTextContent('Building query...');
      expect(dialog).toHaveFocus();

      mockIsGenerating = false;
      await act(async () => {
        await request.tools[0].invoke({
          proposedQuery: 'increase(http_requests_total[5m])',
          why: ['Returns the increase over the selected range.'],
        });
        request.onComplete('');
      });
      rerender(<QueryCoauthoring {...queryCoauthoringProps} />);
      drainAnimationFrames();

      expect(stagePreview).toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
      expect(dialog).toHaveFocus();
    } finally {
      mockIsGenerating = false;
      requestAnimationFrameSpy.mockRestore();
      cancelAnimationFrameSpy.mockRestore();
    }
  });

  it('restores initial prompt focus when query reading completes after Assistant drawer autofocus', async () => {
    let nextAnimationFrameId = 1;
    const animationFrames = new Map<number, FrameRequestCallback>();
    const requestAnimationFrameSpy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      const id = nextAnimationFrameId++;
      animationFrames.set(id, callback);
      return id;
    });
    const cancelAnimationFrameSpy = jest
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation((id) => animationFrames.delete(id));
    const drainAnimationFrames = () => {
      while (animationFrames.size > 0) {
        const [[id, callback]] = animationFrames;
        animationFrames.delete(id);
        act(() => callback(0));
      }
    };
    const assistantDrawerInput = document.createElement('textarea');
    assistantDrawerInput.setAttribute('aria-label', 'Prompt message input');
    document.body.append(assistantDrawerInput);

    try {
      await setup();
      const prompt = screen.getByRole('textbox', { name: 'Describe a query change' });
      drainAnimationFrames();
      expect(prompt).toHaveFocus();

      assistantDrawerInput.focus();
      act(() => mockIdentifySelection.mock.calls[0][0].onComplete('The highlighted query calculates a request rate.'));
      drainAnimationFrames();

      expect(prompt).toHaveFocus();
    } finally {
      mockIsIdentifying = false;
      assistantDrawerInput.remove();
      requestAnimationFrameSpy.mockRestore();
      cancelAnimationFrameSpy.mockRestore();
    }
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

  it('keeps a slightly overlong query-local clarification inline', async () => {
    const { user } = await setup();
    const clarification =
      'I can help make this query less busy by reducing the high cardinality. ' +
      'To group the data and reduce the number of time series, which labels would you prefer to group by—for example, method and cluster, or job and namespace, or something else?';

    await user.type(screen.getByRole('textbox'), "Let's make this less busy");
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));
    act(() => mockGenerate.mock.calls[0][0].onComplete(clarification));

    expect(screen.getByText(clarification)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Add extra detail' })).toBeInTheDocument();
    expect(screen.queryByText(/Continue in Assistant chat to make larger changes/i)).not.toBeInTheDocument();
  });

  it('keeps clarification response controls outside the scrollable message region', async () => {
    const { user } = await setup();
    const longClarification =
      'Would you like to aggregate by method, filter specific traffic, or smooth the resulting series? '.repeat(2);

    await user.type(screen.getByRole('textbox'), 'Make this less noisy');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));
    act(() => mockGenerate.mock.calls[0][0].onComplete(longClarification));

    const message = screen.getByRole('region', { name: 'Clarification message' });
    expect(message).toBe(screen.getByTestId(selectors.components.QueryEditorCoauthoring.container));
    expect(message).toHaveTextContent(/aggregate by method/);
    expect(within(message).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(message).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Add extra detail' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close coauthoring' })).toBeInTheDocument();
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

  it('closes feedback on Escape without dismissing the proposal', async () => {
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
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: 'What went well?' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Query coauthor' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
    expect(dismissInvocation).not.toHaveBeenCalled();
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

  it('does not accept a proposal when Enter activates another control', async () => {
    const unrelatedAction = jest.fn();
    const unrelatedButton = document.createElement('button');
    unrelatedButton.textContent = 'Unrelated page action';
    unrelatedButton.addEventListener('click', unrelatedAction);
    document.body.append(unrelatedButton);
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

    unrelatedButton.focus();
    await user.keyboard('{Enter}');
    expect(unrelatedAction).toHaveBeenCalledTimes(1);
    expect(onAccept).not.toHaveBeenCalled();

    act(() => screen.getByRole('button', { name: 'Helpful' }).focus());
    await user.keyboard('{Enter}');
    expect(screen.getByRole('dialog', { name: 'What went well?' })).toBeInTheDocument();
    expect(onAccept).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');

    act(() => screen.getByRole('button', { name: 'Close coauthoring' }).focus());
    await user.keyboard('{Enter}');
    expect(dismissInvocation).toHaveBeenCalledTimes(1);
    expect(onAccept).not.toHaveBeenCalled();
    unrelatedButton.remove();
  });

  it('leaves Escape to an overlay focused outside the coauthoring surface', async () => {
    const outsideOverlay = document.createElement('button');
    outsideOverlay.textContent = 'Assistant drawer control';
    const outsideKeyDown = jest.fn();
    outsideOverlay.addEventListener('keydown', outsideKeyDown);
    document.body.append(outsideOverlay);
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
    outsideOverlay.focus();
    await user.keyboard('{Escape}');

    expect(outsideKeyDown).toHaveBeenCalledTimes(1);
    expect(dismissInvocation).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
    outsideOverlay.remove();
  });

  it('discards on Escape', async () => {
    const { user, onAccept, dismissInvocation } = await setup();
    const cancelCalls = mockCancel.mock.calls.length;
    const resetCalls = mockReset.mock.calls.length;

    screen.getByRole('textbox', { name: 'Describe a query change' }).focus();
    await user.keyboard('{Escape}');

    expect(onAccept).not.toHaveBeenCalled();
    expect(mockCancel).toHaveBeenCalledTimes(cancelCalls + 1);
    expect(mockReset).toHaveBeenCalledTimes(resetCalls + 1);
    expect(dismissInvocation).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Continue coauthoring' })).not.toBeInTheDocument();
  });

  it('keeps Escape with the coauthoring dialog when the dialog itself owns focus', async () => {
    const panelEditEscape = jest.fn();
    const outsideButton = document.createElement('button');
    document.body.append(outsideButton);
    document.addEventListener('keydown', panelEditEscape);
    const { user, dismissInvocation } = await setup();

    try {
      outsideButton.focus();
      const dialog = screen.getByRole('dialog', { name: 'Query coauthor' });
      dialog.focus();

      expect(dialog).toHaveFocus();
      await user.keyboard('{Escape}');

      expect(dismissInvocation).toHaveBeenCalledTimes(1);
      expect(panelEditEscape).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('keydown', panelEditEscape);
      outsideButton.remove();
    }
  });
});
