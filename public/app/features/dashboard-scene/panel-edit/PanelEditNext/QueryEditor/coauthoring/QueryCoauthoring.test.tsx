import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { type DataQuery } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { QueryCoauthoring } from './QueryCoauthoring';
import { QueryCoauthoringSurface } from './QueryCoauthoringSurface';
import {
  type QueryEditorCoauthoringAdapterV1,
  type QueryEditorCoauthoringContextV1,
  type QueryEditorCoauthoringSnapshotV1,
} from './internalCoauthoringContract';

const mockGenerate = jest.fn().mockResolvedValue(undefined);
const mockCancel = jest.fn();
const mockReset = jest.fn();
const mockOpenAssistant = jest.fn();
const mockPost = jest.fn();
const mockReportInteraction = jest.fn();
const VIEWPORT_TEST_MARGIN = 8;
let mockIsGenerating = false;
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
  useInlineAssistant: () => ({
    generate: mockGenerate,
    isGenerating: mockIsGenerating,
    content: '',
    error: null,
    cancel: mockCancel,
    reset: mockReset,
  }),
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
  props: { isPreviewRunning?: boolean; entry?: boolean } = {}
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
  let snapshot: QueryEditorCoauthoringSnapshotV1 = props.entry
    ? { mode: 'selection', portalTarget: anchorElement }
    : { mode: 'invoked', invocationId: context.revision, portalTarget: anchorElement };
  const listeners = new Set<VoidFunction>();
  const adapter: QueryEditorCoauthoringAdapterV1 = {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    invoke: jest.fn(() => {
      snapshot = { mode: 'invoked', invocationId: context.revision, portalTarget: anchorElement };
      listeners.forEach((listener) => listener());
    }),
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
  const result = render(
    props.entry ? (
      <QueryCoauthoringSurface
        adapter={adapter}
        onBaseline={onBaseline}
        host={{
          datasourceType: 'prometheus',
          previewPhase: 'idle',
          preview: onPreview,
          accept: onAccept,
          revert: onRevertPreview,
        }}
      />
    ) : (
      <QueryCoauthoring {...queryCoauthoringProps} isPreviewRunning={props.isPreviewRunning} />
    )
  );
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
    mockAssistantAvailable = true;
    mockAssistantLoading = false;
  });

  const mentionContext: QueryEditorCoauthoringContextV1 = {
    revision: '1',
    query: 'rate(http_requests_total[5m])',
    focusRanges: [{ from: 0, to: 4 }],
    language: { id: 'promql', displayName: 'PromQL' },
    metadata: [
      { kind: 'metric', name: 'http_inflight_requests' },
      { kind: 'metric', name: 'pending_requests_total' },
      { kind: 'label', name: 'instance' },
      { kind: 'label', name: 'origin' },
    ],
  };

  it('matches metric and label substrings with their icons and caps suggestions at six', async () => {
    const { user, unmount } = await setup(0, true, mentionContext);
    await user.type(screen.getByRole('textbox'), 'Use @in');
    const options = await screen.findAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      'http_inflight_requests',
      'pending_requests_total',
      'instance',
      'origin',
    ]);
    expect(within(options[0]).getByTestId('icon-graph-bar')).toBeInTheDocument();
    expect(within(options[1]).getByTestId('icon-graph-bar')).toBeInTheDocument();
    expect(within(options[2]).getByTestId('icon-tag-alt')).toBeInTheDocument();
    expect(within(options[3]).getByTestId('icon-tag-alt')).toBeInTheDocument();
    unmount();
    await setup(0, true, {
      ...mentionContext,
      metadata: [
        { kind: 'metric', name: 'in_a' },
        { kind: 'metric', name: 'in_b' },
        { kind: 'label', name: 'in_c' },
        { kind: 'label', name: 'in_d' },
        { kind: 'metric', name: 'in_e' },
        { kind: 'label', name: 'in_f' },
        { kind: 'metric', name: 'in_g' },
        { kind: 'label', name: 'in_h' },
      ],
    });
    await user.type(screen.getByRole('textbox'), '@in');
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'in_a',
      'in_b',
      'in_c',
      'in_d',
      'in_e',
      'in_f',
    ]);
  });

  it('moves mention selection with arrow keys and inserts with Enter before a later Enter submits', async () => {
    const { user } = await setup(0, true, mentionContext);
    const input = screen.getByRole('textbox');
    await user.type(input, 'Use @in');
    expect(screen.getByRole('option', { name: 'http_inflight_requests (Metric)' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: 'pending_requests_total (Metric)' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(screen.getByRole('option', { name: 'origin (Label)' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(input).toHaveValue('Use pending_requests_total ');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockReportInteraction).toHaveBeenCalledWith('grafana_query_coauthoring_mention_inserted', {
      kind: 'metric',
    });
    await user.keyboard('{Enter}');
    expect(mockGenerate.mock.calls[0][0].prompt).toBe('Use pending_requests_total');
  });

  it('clicks a portal mention item without dismissing an untouched prompt and reports only its kind', async () => {
    const { user, dismissInvocation } = await setup(0, true, mentionContext);
    const input = screen.getByRole('textbox');
    await user.type(input, 'Group by @in');
    const listbox = await screen.findByRole('listbox');
    expect(screen.getByRole('dialog', { name: 'Query coauthor' })).not.toContainElement(listbox);
    expect(listbox).toHaveStyle({ position: 'fixed' });
    await user.click(screen.getByRole('option', { name: 'instance (Label)' }));
    expect(input).toHaveValue('Group by instance ');
    expect(input).toHaveFocus();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(dismissInvocation).not.toHaveBeenCalled();
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockReportInteraction).toHaveBeenCalledWith('grafana_query_coauthoring_mention_inserted', { kind: 'label' });
  });

  it.each([false, true])(
    'Escape closes only the mention menu before applying engaged=%s close rules',
    async (engaged) => {
      const { user, dismissInvocation } = await setup(0, true, mentionContext);
      if (engaged) {
        await user.click(screen.getByRole('button', { name: 'Explain this query' }));
        act(() => mockGenerate.mock.calls[0][0].onComplete('It calculates the request rate.'));
        await user.click(screen.getByRole('button', { name: 'Modify this query' }));
      }
      await user.type(screen.getByRole('textbox'), 'Use @in');
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(screen.getByRole('textbox')).toHaveValue('Use @in');
      expect(screen.getByRole('dialog', { name: 'Query coauthor' })).toBeInTheDocument();
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(dismissInvocation).not.toHaveBeenCalled();
      await user.keyboard('{Escape}');
      expect(dismissInvocation).toHaveBeenCalledTimes(engaged ? 0 : 1);
    }
  );

  it('leaves @ as plain text without metadata and keeps Shift+Enter for a newline', async () => {
    const { user } = await setup(0, true, { ...mentionContext, metadata: [] });
    const input = screen.getByRole('textbox');
    expect(screen.getByRole('button', { name: 'Coauthor' })).toBeDisabled();
    await user.type(input, 'Use @in');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    await user.type(input, 'and preserve the labels');
    expect(input).toHaveValue('Use @in\nand preserve the labels');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(mockGenerate.mock.calls[0][0].prompt).toBe('Use @in\nand preserve the labels');
  });

  it('disables submission until context loads even when a mention prefix has been typed', async () => {
    const initial = await setup(0, true, mentionContext);
    initial.unmount();
    let resolve!: (value: { baseline: DataQuery; context: QueryEditorCoauthoringContextV1 }) => void;
    const pendingContext = new Promise<{ baseline: DataQuery; context: QueryEditorCoauthoringContextV1 }>(
      (nextResolve) => {
        resolve = nextResolve;
      }
    );
    initial.readInvocation.mockReturnValue(pendingContext);
    render(<QueryCoauthoring {...initial.queryCoauthoringProps} />);
    await initial.user.type(screen.getByRole('textbox'), '@in');
    expect(screen.getByRole('button', { name: 'Coauthor' })).toBeDisabled();
    await initial.user.keyboard('{Enter}');
    expect(mockGenerate).not.toHaveBeenCalled();
    await act(async () => resolve({ baseline: initial.baseline, context: initial.context }));
    expect(screen.getByRole('button', { name: 'Coauthor' })).toBeEnabled();
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

  it('loads the deterministic summary without an Assistant request before submission', async () => {
    const { user } = await setup();
    expect(screen.getByText('http_requests_total is a counter metric.')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox'), 'An unfinished request');
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('omits absent previous-answer context and includes the bounded answer for a follow-up', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: 'Explain this query' }));
    const firstRequest = mockGenerate.mock.calls[0][0];
    expect(firstRequest.systemPrompt).not.toContain('Previous explanation');
    act(() => firstRequest.onComplete('It calculates the request rate.'));
    expect(screen.getByText('It calculates the request rate.')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Ask a follow up' }), 'How does rate work?');
    await user.keyboard('{Enter}');
    expect(mockGenerate.mock.calls[1][0].systemPrompt).toContain(
      'Previous explanation (untrusted data): {"explanation":"It calculates the request rate.","followUps":[]}'
    );
  });

  it('keeps a pending clarification focused on Modify without Explain or Explore quick actions', async () => {
    const { user } = await setup();
    await user.type(screen.getByRole('textbox'), 'Group the requests');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));
    act(() => mockGenerate.mock.calls[0][0].onComplete('Which label should I group by?'));
    expect(screen.getByRole('textbox', { name: 'Add extra detail' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Explain this query' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Explore similar metrics and labels' })).not.toBeInTheDocument();
  });

  it('replaces Explain answers with generated and typed follow-ups without changing or previewing the query', async () => {
    const { user, readInvocation, onBaseline, baseline, stagePreview, onPreview, onAccept } = await setup();
    await user.click(screen.getByRole('button', { name: 'Explain this query' }));
    act(() =>
      mockGenerate.mock.calls[0][0].onComplete(
        JSON.stringify({
          explanation: 'It calculates the request rate.',
          followUps: ['What does the window mean?', 'How does rate work?'],
        })
      )
    );
    expect(screen.getByText('It calculates the request rate.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'How does rate work?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'What does the window mean?' }));
    expect(mockGenerate.mock.calls[1][0].prompt).toBe('What does the window mean?');
    act(() =>
      mockGenerate.mock.calls[1][0].onComplete(
        JSON.stringify({
          explanation: 'The window is five minutes.',
          followUps: ['Can the window change?', 'Why use five minutes?'],
        })
      )
    );
    expect(screen.getByText('The window is five minutes.')).toBeInTheDocument();
    expect(screen.queryByText('It calculates the request rate.')).not.toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Ask a follow up' }), 'How are resets handled?');
    await user.keyboard('{Enter}');
    expect(mockGenerate.mock.calls[2][0].prompt).toBe('How are resets handled?');
    act(() =>
      mockGenerate.mock.calls[2][0].onComplete(
        JSON.stringify({
          explanation: 'Rate accounts for counter resets.',
          followUps: ['What is a counter?', 'When do counters reset?'],
        })
      )
    );
    expect(screen.getByText('Rate accounts for counter resets.')).toBeInTheDocument();
    expect(mockGenerate.mock.calls[0][0].tools).toBeUndefined();
    expect(readInvocation).toHaveBeenCalledTimes(1);
    expect(onBaseline).toHaveBeenCalledTimes(1);
    expect(onBaseline).toHaveBeenCalledWith(baseline);
    expect(stagePreview).not.toHaveBeenCalled();
    expect(onPreview).not.toHaveBeenCalled();
    expect(onAccept).not.toHaveBeenCalled();
    expect(mockReportInteraction).toHaveBeenCalledWith('grafana_query_coauthoring_explain_follow_up_submitted', {
      source: 'generated',
    });
    expect(mockReportInteraction).toHaveBeenCalledWith('grafana_query_coauthoring_explain_follow_up_submitted', {
      source: 'typed',
    });
  });

  it.each([
    'The request rate is averaged over five minutes.',
    JSON.stringify({
      explanation: 'The request rate is averaged over five minutes.',
      followUps: ['Only one question?'],
    }),
  ])('degrades malformed structured Explain output to the explanation alone: %s', async (completion) => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: 'Explain this query' }));
    act(() => mockGenerate.mock.calls[0][0].onComplete(completion));
    expect(screen.getByText('The request rate is averaged over five minutes.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Ask a follow up' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Only one question?' })).not.toBeInTheDocument();
  });

  it('explores only existing metadata and hides the quick action when metadata is empty', async () => {
    const { user, context, readInvocation, unmount } = await setup();
    await user.click(screen.getByRole('button', { name: 'Explore similar metrics and labels' }));
    const request = mockGenerate.mock.calls[0][0];
    expect(request.systemPrompt).toContain(JSON.stringify(context.metadata));
    expect(request.systemPrompt).toContain(
      'Do not invent metric or label names that are not in the provided metadata.'
    );
    act(() => request.onComplete('The context contains the HTTP requests counter.'));
    expect(screen.getByText('The context contains the HTTP requests counter.')).toBeInTheDocument();
    expect(readInvocation).toHaveBeenCalledTimes(1);
    expect(mockReportInteraction).toHaveBeenCalledWith('grafana_query_coauthoring_explore_similar_used', {});
    unmount();
    await setup(0, true, { ...context, metadata: [] });
    expect(screen.getByRole('button', { name: 'Explain this query' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Explore similar metrics and labels' })).not.toBeInTheDocument();
  });

  it('moves from Explain to Modify in the same engaged invocation and does not count Explain toward the nudge', async () => {
    const { user, readInvocation, stagePreview, dismissInvocation } = await setup();
    await user.click(screen.getByRole('button', { name: 'Explain this query' }));
    for (let i = 0; i < 4; i++) {
      act(() =>
        mockGenerate.mock.calls[i][0].onComplete(
          JSON.stringify({
            explanation: 'It calculates the request rate.',
            followUps: ['How does rate work?', 'What is a counter?'],
          })
        )
      );
      if (i < 3) {
        await user.click(screen.getByRole('button', { name: 'How does rate work?' }));
      }
    }
    await user.click(screen.getByRole('button', { name: 'Modify this query' }));
    expect(screen.getByRole('textbox', { name: 'Describe a query change' })).toHaveValue('');
    await user.click(document.body);
    act(() => screen.getByRole('dialog', { name: 'Query coauthor' }).focus());
    await user.keyboard('{Escape}');
    expect(dismissInvocation).not.toHaveBeenCalled();
    await user.type(screen.getByRole('textbox', { name: 'Describe a query change' }), 'Group the requests');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));
    act(() => mockGenerate.mock.calls[4][0].onComplete('Which label should I group by?'));
    expect(screen.getByRole('textbox', { name: 'Add extra detail' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue here' })).not.toBeInTheDocument();
    expect(readInvocation).toHaveBeenCalledTimes(1);
    expect(stagePreview).not.toHaveBeenCalled();
  });

  it.each(['prompt', 'Explain'])(
    'restores the prior %s and submitted text on Stop and ignores late Explain completion',
    async (prior) => {
      const { user, dismissInvocation } = await setup();
      await user.click(screen.getByRole('button', { name: 'Explain this query' }));
      if (prior === 'Explain') {
        act(() => mockGenerate.mock.calls[0][0].onComplete('It calculates the request rate.'));
        await user.type(screen.getByRole('textbox', { name: 'Ask a follow up' }), 'Why use a counter?');
        await user.keyboard('{Enter}');
      }
      const pending = mockGenerate.mock.calls.at(-1)[0];
      await user.click(screen.getByRole('button', { name: 'Stop' }));
      if (prior === 'Explain') {
        expect(screen.getByText('It calculates the request rate.')).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: 'Ask a follow up' })).toHaveValue('Why use a counter?');
      } else {
        expect(screen.getByRole('textbox', { name: 'Describe a query change' })).toHaveValue(
          'Explain the focused part of this existing PromQL query.'
        );
      }
      act(() => pending.onComplete('This late answer should be ignored.'));
      expect(screen.queryByText('This late answer should be ignored.')).not.toBeInTheDocument();
      expect(dismissInvocation).not.toHaveBeenCalled();
    }
  );

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

  it('requests a privacy-bounded explanation only after selecting Explain', async () => {
    const { user, queryText, dismissInvocation } = await setup();
    await user.click(screen.getByRole('button', { name: 'Explain this query' }));
    const request = mockGenerate.mock.calls[0][0];
    expect(request).toMatchObject({
      origin: 'grafana/panel-edit-next/query-coauthoring/explain',
      agentName: 'query-coauthor-explain',
      agentId: 'grafana.query.coauthor.explain.v1',
      prompt: 'Explain the focused part of this existing PromQL query.',
    });
    expect(request.systemPrompt).toContain(JSON.stringify(queryText));
    expect(request.systemPrompt).toContain('Focused text: ["rate"]');
    expect(request.systemPrompt).not.toContain('dashboardTitle');
    await user.click(document.body);
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
    expect(dismissInvocation).not.toHaveBeenCalled();
    act(() => request.onComplete('Calculates the per-second request rate.'));
    expect(screen.getByText('Calculates the per-second request rate.')).toBeInTheDocument();
    expect(screen.getByText('Highlighted query')).toBeInTheDocument();
  });

  it('does not request an explanation when focus moves between the prompt and deterministic summary', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('textbox', { name: 'Describe a query change' }));
    await user.click(screen.getByText('http_requests_total is a counter metric.'));
    expect(screen.getByRole('button', { name: 'Explain this query' })).toBeInTheDocument();
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('does not request an explanation when the host time range changes after context loads', async () => {
    const { queryCoauthoringProps, rerender } = await setup();
    rerender(<QueryCoauthoring {...queryCoauthoringProps} timeRange={{ from: 3_000, to: 4_000 }} />);
    expect(screen.getByText('http_requests_total is a counter metric.')).toBeInTheDocument();
    expect(mockGenerate).not.toHaveBeenCalled();
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
    render(<RowOwner />);

    await screen.findByRole('textbox', { name: 'Describe a query change' });

    expect(readInvocation).toHaveBeenCalledTimes(1);
  });

  it('requests a holistic explanation when the whole query is focused', async () => {
    const query = 'rate(http_requests_total[5m])';
    const { user } = await setup(0, true, {
      revision: '1',
      query,
      focusRanges: [{ from: 0, to: query.length }],
      language: { id: 'promql', displayName: 'PromQL' },
      metadata: [{ kind: 'metric', name: 'http_requests_total', attributes: { type: 'counter' } }],
    });

    await user.click(screen.getByRole('button', { name: 'Explain this query' }));
    const request = mockGenerate.mock.calls[0][0];
    expect(request.prompt).toBe('Explain this existing PromQL query as a whole.');
    expect(request.systemPrompt).toContain('Focus scope: whole query.');
    expect(request.systemPrompt).toContain('Explain how the complete query works as one expression.');

    act(() => request.onComplete(''));
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

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Explain this query' }));
    const explanationRequest = mockGenerate.mock.calls[0][0];
    expect(explanationRequest).toMatchObject({
      agentName: 'query-coauthor-explain',
      prompt: 'Explain the focused part of this existing LogQL query.',
    });
    expect(explanationRequest.systemPrompt).toContain('Query language: {"id":"logql"');
    expect(explanationRequest.systemPrompt).not.toContain('PromQL');

    act(() => explanationRequest.onComplete('It filters checkout errors.'));
    await user.click(screen.getByRole('button', { name: 'Modify this query' }));
    await user.type(screen.getByRole('textbox'), 'Match timeout errors');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));

    const request = mockGenerate.mock.calls[1][0];
    expect(request.agentName).toBe('query-coauthor');
    expect(request.systemPrompt).toContain('You help LogQL novices');
    expect(request.systemPrompt).toContain('Preserve the stream selector');
    expect(request.systemPrompt).not.toContain('PromQL');
    expect(request.tools[0].description).toContain('current LogQL query');
  });

  it('shows an explicit dismissal path when Assistant is unavailable', async () => {
    mockAssistantAvailable = false;
    const { user, dismissInvocation, readInvocation } = await setup(0, false);

    expect(await screen.findByText('Assistant unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Describe a query change' })).not.toBeInTheDocument();
    expect(readInvocation).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Close coauthoring' }));

    expect(dismissInvocation).toHaveBeenCalled();
  });

  it('offers the entry pill without Assistant and opens the informational unavailable view', async () => {
    mockAssistantAvailable = false;
    const { user, readInvocation } = await setup(0, false, undefined, { entry: true });
    await user.click(screen.getByRole('button', { name: /Explain or modify/ }));
    expect(await screen.findByText('Assistant unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close coauthoring' })).toBeInTheDocument();
    expect(readInvocation).not.toHaveBeenCalled();
  });

  it('closes an untouched prompt on an outside click even after typing', async () => {
    const { user, dismissInvocation } = await setup();
    await user.type(screen.getByRole('textbox', { name: 'Describe a query change' }), 'A pending instruction');
    await user.click(document.body);
    expect(dismissInvocation).toHaveBeenCalledTimes(1);
  });

  it.each(['clarification', 'error', 'nudge'])('keeps an engaged %s open on outside click and Escape', async (view) => {
    const { user, dismissInvocation } = await setup();
    const attempts = view === 'nudge' ? 3 : 1;
    for (let i = 0; i < attempts; i++) {
      await user.type(screen.getByRole('textbox'), 'Group the requests');
      await user.click(screen.getByRole('button', { name: i ? 'Continue' : 'Coauthor' }));
      act(() => {
        const request = mockGenerate.mock.calls[i][0];
        if (view === 'error') {
          request.onError(new Error('Request failed'));
        } else {
          request.onComplete('Which label should I group by?');
        }
      });
    }
    const dialog = screen.getByRole('dialog', { name: 'Query coauthor' });
    await user.click(document.body);
    act(() => dialog.focus());
    await user.keyboard('{Escape}');
    expect(dialog).toBeInTheDocument();
    expect(dismissInvocation).not.toHaveBeenCalled();
    if (view === 'nudge') {
      await user.click(screen.getByRole('button', { name: 'Continue here' }));
      expect(screen.getByRole('textbox', { name: 'Add extra detail' })).toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(dismissInvocation).not.toHaveBeenCalled();
    }
  });

  it('keeps an engaged working session open on outside click and Escape', async () => {
    const { user, rerender, queryCoauthoringProps, dismissInvocation } = await setup();
    await user.type(screen.getByRole('textbox'), 'Use increase');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));
    mockIsGenerating = true;
    rerender(<QueryCoauthoring {...queryCoauthoringProps} />);
    await user.click(document.body);
    act(() => screen.getByRole('dialog', { name: 'Query coauthor' }).focus());
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
    expect(dismissInvocation).not.toHaveBeenCalled();
  });

  it('shows the selected focus and only counts extra metrics in the working context chip, then restores text on Stop', async () => {
    const context: QueryEditorCoauthoringContextV1 = {
      revision: '1',
      query: 'rate(http_requests_total[5m])',
      focusRanges: [{ from: 0, to: 4 }],
      language: { id: 'promql', displayName: 'PromQL' },
      metadata: [
        { kind: 'label', name: 'handler' },
        { kind: 'metric', name: 'http_requests_total' },
        { kind: 'metric', name: 'http_request_duration_seconds' },
        { kind: 'label', name: 'job' },
        { kind: 'metric', name: 'http_requests_failed_total' },
      ],
    };
    const { user, rerender, queryCoauthoringProps } = await setup(0, true, context);
    await user.type(screen.getByRole('textbox'), 'Use increase');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));
    mockIsGenerating = true;
    rerender(<QueryCoauthoring {...queryCoauthoringProps} />);
    expect(screen.getByLabelText('Query focus')).toHaveTextContent('rate');
    expect(screen.getByLabelText('Relevant query context')).toHaveTextContent('http_requests_total +2');
    await user.click(screen.getByRole('button', { name: 'Stop' }));
    mockIsGenerating = false;
    rerender(<QueryCoauthoring {...queryCoauthoringProps} />);
    expect(screen.getByRole('textbox', { name: 'Describe a query change' })).toHaveValue('Use increase');
  });

  it('answers a clarification with the specified copy within the same invocation', async () => {
    const { user, readInvocation, stagePreview } = await setup();
    await user.type(screen.getByRole('textbox'), 'Group the requests');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));
    act(() => mockGenerate.mock.calls[0][0].onComplete('Which label should I group by?'));
    const input = screen.getByRole('textbox', { name: 'Add extra detail' });
    expect(input).toHaveAttribute('placeholder', 'Add extra detail…');
    expect(screen.getByRole('button', { name: 'Continue in Assistant chat' })).toBeInTheDocument();
    await user.type(input, 'Use handler');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    const request = mockGenerate.mock.calls[1][0];
    await act(async () => {
      await request.tools[0].invoke({
        proposedQuery: 'sum by (handler) (rate(http_requests_total[5m]))',
        why: ['Group by handler.'],
      });
      request.onComplete('');
    });
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
    expect(stagePreview).toHaveBeenCalledWith('1', 'sum by (handler) (rate(http_requests_total[5m]))');
    expect(readInvocation).toHaveBeenCalledTimes(1);
  });

  it('counts initial Modify reached from Explain and clarification submissions for the nudge', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: 'Explain this query' }));
    act(() => mockGenerate.mock.calls[0][0].onComplete('It calculates the request rate.'));
    await user.click(screen.getByRole('button', { name: 'Modify this query' }));
    await user.type(screen.getByRole('textbox'), 'Group the requests');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));
    act(() => mockGenerate.mock.calls[1][0].onComplete('Which label should I group by?'));
    await user.type(screen.getByRole('textbox'), 'Use handler');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    act(() => mockGenerate.mock.calls[2][0].onComplete('Which range should I use?'));
    expect(screen.getByRole('textbox', { name: 'Add extra detail' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue here' })).not.toBeInTheDocument();
    await user.type(screen.getByRole('textbox'), 'Use ten minutes');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    act(() => mockGenerate.mock.calls[3][0].onComplete('Should I keep the labels?'));
    expect(screen.getByRole('button', { name: 'Continue in Assistant' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue here' }));
    expect(screen.getByText('Should I keep the labels?')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Add extra detail' })).toBeInTheDocument();
  });

  it('retries a context failure in the prompt slot without reopening the invocation', async () => {
    const initial = await setup();
    initial.unmount();
    initial.readInvocation.mockClear();
    initial.readInvocation.mockRejectedValueOnce(new Error('Context unavailable'));
    render(<QueryCoauthoring {...initial.queryCoauthoringProps} />);
    expect(await screen.findByText('Context failed to load')).toBeInTheDocument();
    await initial.user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('http_requests_total is a counter metric.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Describe a query change' })).toHaveValue('');
    expect(initial.readInvocation).toHaveBeenNthCalledWith(2, '1');
    expect(initial.capability.invoke).not.toHaveBeenCalled();
  });

  it.each(['Close coauthoring', 'Cancel'])('keeps the proposal preview until explicit %s', async (action) => {
    const { user, onPreview, onRevertPreview, dismissInvocation } = await setup();
    await user.type(screen.getByRole('textbox'), 'Use increase');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));
    const request = mockGenerate.mock.calls[0][0];
    await act(async () => {
      await request.tools[0].invoke({ proposedQuery: 'increase(http_requests_total[5m])', why: ['Use an increase.'] });
      request.onComplete('');
    });
    await user.click(document.body);
    act(() => screen.getByRole('dialog', { name: 'Query coauthor' }).focus());
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
    expect(onPreview).toHaveBeenCalledTimes(1);
    expect(onRevertPreview).not.toHaveBeenCalled();
    expect(dismissInvocation).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: action }));
    expect(onRevertPreview).toHaveBeenCalledTimes(1);
    expect(dismissInvocation).toHaveBeenCalledTimes(1);
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

    expect(screen.getByRole('status')).toHaveTextContent('Building query…');
    expect(await screen.findByLabelText('Query focus')).toHaveTextContent('Focus');
    expect(screen.getByLabelText('Query focus')).toHaveTextContent('rate');
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

    expect(screen.getByText('Building query…')).toBeInTheDocument();
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
    await user.click(screen.getByRole('button', { name: 'Close coauthoring' }));

    expect(mockCancel).toHaveBeenCalledTimes(cancelCalls + 1);
    expect(mockReset).toHaveBeenCalledTimes(resetCalls + 1);
    expect(dismissInvocation).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Continue coauthoring' })).not.toBeInTheDocument();
  });

  it('closes an untouched interaction when the background is clicked', async () => {
    const { user, dismissInvocation } = await setup();

    await user.click(document.body);

    expect(screen.getByRole('dialog', { name: 'Query coauthor' })).toBeInTheDocument();
    expect(dismissInvocation).toHaveBeenCalledTimes(1);
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
      expect(screen.getByRole('status')).toHaveTextContent('Building query…');

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
      expect(screen.getByRole('status')).toHaveTextContent('Building query…');

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
      expect(screen.getByRole('status')).toHaveTextContent('Building query…');
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

  it('restores initial prompt focus when query context loads after Assistant drawer autofocus', async () => {
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
      const { capability, context, baseline, queryCoauthoringProps, unmount } = await setup();
      unmount();
      let resolve!: (value: { baseline: DataQuery; context: QueryEditorCoauthoringContextV1 }) => void;
      const pendingContext = new Promise<{ baseline: DataQuery; context: QueryEditorCoauthoringContextV1 }>(
        (nextResolve) => {
          resolve = nextResolve;
        }
      );
      jest.mocked(capability.readInvocation).mockReturnValue(pendingContext);
      render(<QueryCoauthoring {...queryCoauthoringProps} />);
      const prompt = screen.getByRole('textbox', { name: 'Describe a query change' });
      drainAnimationFrames();
      expect(prompt).toHaveFocus();
      assistantDrawerInput.focus();
      await act(async () => resolve({ baseline, context }));
      drainAnimationFrames();

      expect(prompt).toHaveFocus();
    } finally {
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
    await user.click(
      within(screen.getByRole('dialog', { name: 'What went wrong?' })).getByRole('button', { name: 'Cancel' })
    );

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
