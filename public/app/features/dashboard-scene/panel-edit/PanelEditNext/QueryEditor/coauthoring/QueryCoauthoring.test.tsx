import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import { type DataQuery, getDefaultTimeRange, LoadingState, type PanelData, toDataFrame } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { SceneQueryRunner, VizPanel } from '@grafana/scenes';

import { QueryCoauthoring } from './QueryCoauthoring';
import { QueryCoauthoringSurface } from './QueryCoauthoringSurface';
import {
  type QueryEditorCoauthoringAdapterV1,
  type QueryEditorCoauthoringContextV1,
  type QueryEditorCoauthoringSnapshotV1,
} from './internalCoauthoringContract';
import { startQueryPreview } from './queryPreview';
import { useQueryProposalTransaction } from './useQueryProposalTransaction';

const mockGenerate = jest.fn().mockImplementation(() => new Promise<void>(() => undefined));
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

function QueryEditorFixture({
  query,
  adapter,
  onChange,
}: {
  query: DataQuery;
  adapter: QueryEditorCoauthoringAdapterV1;
  onChange: (query: DataQuery) => void;
}) {
  const source = 'expr' in query && typeof query.expr === 'string' ? query.expr : '';
  const latest = useRef({ source, query, onChange });
  latest.current = { source, query, onChange };
  const handleContentChange = useCallback(
    (value: string) => {
      if (value === latest.current.source) {
        return;
      }
      adapter.dismiss();
      const updated: DataQuery & { expr: string } = { ...latest.current.query, expr: value };
      latest.current.onChange(updated);
    },
    [adapter]
  );
  useLayoutEffect(() => handleContentChange(source), [handleContentChange, source]);
  return (
    <textarea
      aria-label="Query editor"
      value={source}
      onChange={(event) => handleContentChange(event.currentTarget.value)}
    />
  );
}

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
  props: { isPreviewRunning?: boolean; entry?: boolean; transaction?: boolean; realPreview?: boolean } = {}
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
  const onAccept = jest.fn((_query: DataQuery, _originalRefId?: string) => true);
  const onPreview = jest.fn(() => true);
  const onRevertPreview = jest.fn();
  const onBaseline = jest.fn(() => true);
  const anchorElement = document.createElement('div');
  const baseline = { refId: 'A', expr: context.query } as DataQuery;
  const panelResult = (value: number): PanelData => ({
    state: LoadingState.Done,
    series: [toDataFrame({ refId: 'A', fields: [{ name: 'value', values: [value] }] })],
    timeRange: getDefaultTimeRange(),
  });
  const baselineData = panelResult(10);
  const queryRunner = new SceneQueryRunner({ queries: [baseline], data: baselineData });
  const panel = new VizPanel({ key: 'panel-1', $data: queryRunner });
  const previewRequests: SceneQueryRunner[] = [];
  if (props.realPreview) {
    jest.spyOn(SceneQueryRunner.prototype, 'cancelQuery').mockImplementation();
    jest.spyOn(SceneQueryRunner.prototype, 'runQueries').mockImplementation(function (this: SceneQueryRunner) {
      previewRequests.push(this);
      this.setState({ data: { state: LoadingState.Loading, series: [], timeRange: getDefaultTimeRange() } });
    });
    onAccept.mockImplementation((query: DataQuery) => {
      queryRunner.setState({ queries: [query] });
      return true;
    });
  }
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
  if (props.transaction) {
    dismissInvocation.mockImplementation(() => {
      snapshot = { mode: 'hidden' };
      listeners.forEach((listener) => listener());
    });
  }
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
  function TransactionHarness() {
    const transaction = useQueryProposalTransaction({
      query: baseline,
      queries: [baseline],
      queryKey: 'prometheus:A',
      adapter,
      updateQuery: onAccept,
      runQueries: jest.fn(),
      startQueryPreview: props.realPreview
        ? (refId, query) => startQueryPreview(panel, refId, query)
        : () => ({
            dispose: () => undefined,
            select: () => true,
            subscribeToState: () => () => undefined,
            subscribeToData: () => () => undefined,
          }),
    });
    return (
      <>
        {transaction.editorQuery && (
          <QueryEditorFixture query={transaction.editorQuery} adapter={adapter} onChange={transaction.onChange} />
        )}
        <QueryCoauthoringSurface
          adapter={adapter}
          onBaseline={transaction.synchronizeBaseline}
          host={{
            datasourceType: 'prometheus',
            previewPhase: transaction.previewPhase,
            preview: transaction.preview,
            accept: transaction.accept,
            revert: transaction.revert,
          }}
        />
      </>
    );
  }
  const result = render(
    props.transaction ? (
      <TransactionHarness />
    ) : props.entry ? (
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
    baselineData,
    queryRunner,
    panelResult,
    previewRequests,
    user: userEvent.setup(),
    ...result,
  };
}

describe('QueryCoauthoring', () => {
  it('shows the selected token diff above why, using Core Focus ranges rather than adapter annotations', async () => {
    const { user, stagePreview } = await setup();
    stagePreview.mockImplementation((_id, source) => {
      const query: DataQuery & { expr: string } = { refId: 'A', expr: source };
      return {
        status: 'ready',
        query,
        changes: [
          {
            id: 'misleading',
            original: 'wrong-original',
            proposed: 'wrong-proposed',
            focus: 'inside',
            kind: 'expression',
          },
        ],
      };
    });
    await user.type(screen.getByRole('textbox'), 'Count requests');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));
    const request = mockGenerate.mock.calls[0][0];
    await act(async () => {
      await request.tools[0].invoke({
        options: [
          {
            proposedQuery: 'sum(rate(http_requests_total[5m]))',
            why: ['Aggregate the rate.'],
            unconfirmedValues: ['code="999"'],
          },
          { proposedQuery: 'increase(http_requests_total[5m])', why: ['Count the requests.'] },
        ],
      });
      request.onComplete('');
    });
    const diff = screen.getByLabelText('Query diff');
    expect(within(diff).getAllByLabelText('Change outside Focus')).toHaveLength(2);
    expect(
      diff.compareDocumentPosition(screen.getByText('Aggregate the rate.')) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(screen.queryByText('wrong-original')).not.toBeInTheDocument();
    expect(screen.getByText('Unconfirmed:')).toBeVisible();
    expect(screen.getByTestId('icon-exclamation-triangle')).toHaveAttribute('aria-hidden', 'true');
    await user.click(screen.getByRole('tab', { name: 'Option 2' }));
    expect(screen.getByLabelText('Query diff')).toHaveTextContent('increase');
    expect(
      within(screen.getByLabelText('Query diff')).queryByLabelText('Change outside Focus')
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Original' }));
    expect(screen.queryByLabelText('Query diff')).not.toBeInTheDocument();
  });

  it('keeps the editor and selected card together through rapid option and Original switches', async () => {
    const { user, dismissInvocation, onAccept } = await setup(0, true, undefined, { transaction: true });
    await user.type(screen.getByRole('textbox', { name: 'Describe a query change' }), 'Count requests');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));
    const request = mockGenerate.mock.calls[0][0];
    await act(async () => {
      await request.tools[0].invoke({
        options: [
          { proposedQuery: 'increase(http_requests_total[5m])', why: ['Counts.'] },
          { proposedQuery: 'sum(increase(http_requests_total[5m]))', why: ['Total.'] },
        ],
      });
      request.onComplete('');
    });
    expect(screen.getByRole('textbox', { name: 'Query editor' })).toHaveValue('increase(http_requests_total[5m])');
    await user.click(screen.getByRole('tab', { name: 'Option 2' }));
    expect(screen.getByRole('textbox', { name: 'Query editor' })).toHaveValue('sum(increase(http_requests_total[5m]))');
    await user.click(screen.getByRole('tab', { name: 'Original' }));
    expect(screen.getByRole('textbox', { name: 'Query editor' })).toHaveValue('rate(http_requests_total[5m])');
    await user.click(screen.getByRole('tab', { name: 'Option 1' }));
    act(() => {
      fireEvent.click(screen.getByRole('tab', { name: 'Option 2' }));
      fireEvent.click(screen.getByRole('tab', { name: 'Original' }));
      fireEvent.click(screen.getByRole('tab', { name: 'Option 1' }));
    });
    expect(screen.getByRole('tab', { name: 'Option 1' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('textbox', { name: 'Query editor' })).toHaveValue('increase(http_requests_total[5m])');
    expect(dismissInvocation).not.toHaveBeenCalled();
    expect(onAccept).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Query editor' }), {
      target: { value: 'sum(http_requests_total)' },
    });
    expect(onAccept).toHaveBeenCalledWith({ refId: 'A', expr: 'sum(http_requests_total)' }, 'A');
    expect(screen.queryByRole('dialog', { name: 'Query coauthor' })).not.toBeInTheDocument();
    expect(dismissInvocation).toHaveBeenCalled();
  });

  it('keeps the real preview transaction alive on Original, reuses cached data, and accepts the selected query', async () => {
    const { user, baseline, baselineData, queryRunner, panelResult, previewRequests } = await setup(
      0,
      true,
      undefined,
      {
        transaction: true,
        realPreview: true,
      }
    );
    await user.type(screen.getByRole('textbox', { name: 'Describe a query change' }), 'Count requests');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));
    const request = mockGenerate.mock.calls[0][0];
    await act(async () => {
      await request.tools[0].invoke({
        options: [
          { proposedQuery: 'increase(http_requests_total[5m])', why: ['Counts.'] },
          { proposedQuery: 'sum(increase(http_requests_total[5m]))', why: ['Total.'] },
        ],
      });
      request.onComplete('');
    });
    expect(screen.getByText('Running updated query...')).toBeVisible();
    expect(queryRunner.state.data).toBe(baselineData);
    const first = panelResult(11);
    act(() => previewRequests[0].setState({ data: first }));
    await user.click(screen.getByRole('tab', { name: 'Option 2' }));
    expect(screen.getByText('Total.')).toBeVisible();
    expect(queryRunner.state.data).toBe(first);
    const second = panelResult(12);
    act(() => previewRequests[1].setState({ data: second }));
    await user.click(screen.getByRole('tab', { name: 'Original' }));
    expect(screen.getByRole('textbox', { name: 'Query editor' })).toHaveValue('rate(http_requests_total[5m])');
    expect(screen.getByRole('button', { name: 'Accept' })).toBeDisabled();
    expect(queryRunner.state.data).toBe(baselineData);
    expect(queryRunner.state.queries).toEqual([baseline]);
    await user.click(screen.getByRole('tab', { name: 'Option 2' }));
    expect(screen.getByRole('textbox', { name: 'Query editor' })).toHaveValue('sum(increase(http_requests_total[5m]))');
    expect(screen.getByText('Previewing query')).toBeVisible();
    expect(queryRunner.state.data).toBe(second);
    expect(previewRequests).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Accept' }));
    expect(queryRunner.state.queries).toEqual([{ refId: 'A', expr: 'sum(increase(http_requests_total[5m]))' }]);
    expect(screen.queryByRole('dialog', { name: 'Query coauthor' })).not.toBeInTheDocument();
  });

  it('shows a retryable error when an option cannot be previewed instead of leaving a selected card over Baseline', async () => {
    const { user, onPreview } = await setup();
    await user.type(screen.getByRole('textbox'), 'Count requests');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));
    const request = mockGenerate.mock.calls[0][0];
    await act(async () => {
      await request.tools[0].invoke({
        options: [
          { proposedQuery: 'increase(http_requests_total[5m])', why: ['Counts.'] },
          { proposedQuery: 'sum(increase(http_requests_total[5m]))', why: ['Total.'] },
        ],
      });
      request.onComplete('');
    });
    onPreview.mockReturnValue(false);
    await user.click(screen.getByRole('tab', { name: 'Option 2' }));
    expect(screen.getByText('The query proposal could not be previewed. Try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('ranks surviving options, selects Original with the keyboard, and accepts the exact selected query', async () => {
    const { user, stagePreview, onPreview, onAccept, baseline, dismissInvocation } = await setup();
    stagePreview.mockImplementation((_id, source) => {
      if (source === 'invalid(') {
        return { status: 'rejected', reason: 'invalid' };
      }
      const query: DataQuery & { expr: string } = { refId: 'A', expr: source };
      return { status: 'ready', query, changes: [] };
    });
    await user.type(screen.getByRole('textbox'), 'Show request counts');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));
    const request = mockGenerate.mock.calls[0][0];
    const second = 'sum( increase(http_requests_total[5m]) )';
    await act(async () => {
      await request.tools[0].invoke({
        options: [
          { proposedQuery: 'increase(http_requests_total[5m])', why: ['Counts per series.'] },
          { proposedQuery: 'invalid(', why: ['Rejected syntax.'] },
          { proposedQuery: second, why: ['Total counts.'], unconfirmedValues: ['handler="unknown"'] },
        ],
      });
      request.onComplete('');
    });
    const original = screen.getByRole('tab', { name: 'Original' });
    const first = screen.getByRole('tab', { name: 'Option 1' });
    expect(first).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('tab', { name: 'Option 3' })).not.toBeInTheDocument();
    act(() => first.focus());
    await user.keyboard('{ArrowLeft}');
    expect(original).toHaveFocus();
    expect(original).toHaveAttribute('aria-selected', 'true');
    expect(onPreview).toHaveBeenLastCalledWith(baseline, { debounce: true });
    expect(screen.getByRole('button', { name: 'Accept' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Open in Chat' })).toBeEnabled();
    await user.keyboard('{End}');
    expect(screen.getByText('Total counts.')).toBeInTheDocument();
    expect(screen.getByText('handler="unknown"')).toBeInTheDocument();
    expect(onPreview).toHaveBeenLastCalledWith({ refId: 'A', expr: second }, { debounce: true });
    expect(dismissInvocation).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Accept' }));
    expect(onAccept).toHaveBeenCalledWith({ refId: 'A', expr: second });
  });

  it('drops whitespace-only Baseline changes and duplicate options without requesting a repair', async () => {
    const { user, stagePreview } = await setup();
    await user.type(screen.getByRole('textbox'), 'Count requests');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));
    const request = mockGenerate.mock.calls[0][0];
    await act(async () => {
      await request.tools[0].invoke({
        options: [
          { proposedQuery: ' rate(http_requests_total[5m]) ', why: ['Whitespace only.'] },
          { proposedQuery: 'increase(http_requests_total[5m])', why: ['First ranked answer.'] },
          { proposedQuery: ' increase(http_requests_total[5m]) ', why: ['Duplicate.'] },
        ],
      });
      request.onComplete('');
    });
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.getByText('First ranked answer.')).toBeInTheDocument();
    expect(stagePreview).toHaveBeenCalledTimes(1);
  });

  it('hands off all ranked options and Original selection and sends only rank and count with feedback', async () => {
    const { user } = await setup();
    await user.type(screen.getByRole('textbox'), 'Count requests');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));
    const request = mockGenerate.mock.calls[0][0];
    await act(async () => {
      await request.tools[0].invoke({
        options: [
          { proposedQuery: 'increase(http_requests_total[5m])', why: ['Counts.'] },
          { proposedQuery: 'sum(increase(http_requests_total[5m]))', why: ['Total.'] },
        ],
      });
      request.onComplete('');
    });
    await user.click(screen.getByRole('tab', { name: 'Option 2' }));
    await user.click(screen.getByRole('button', { name: 'Helpful' }));
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(mockPost.mock.calls[0][1].metadata).toEqual({ outcome: 'proposal', selectedOptionRank: 2, optionCount: 2 });
    expect(mockReportInteraction).toHaveBeenCalledWith('grafana_query_coauthoring_option_selected', { rank: 2 });
    await user.click(screen.getByRole('tab', { name: 'Original' }));
    await user.click(screen.getByRole('button', { name: 'Open in Chat' }));
    const handoff = mockOpenAssistant.mock.calls[0][0];
    expect(handoff.context[0].node.data.data).toMatchObject({
      currentQuery: 'rate(http_requests_total[5m])',
      inlineProposals: [
        { query: 'increase(http_requests_total[5m])', explanation: ['Counts.'] },
        { query: 'sum(increase(http_requests_total[5m]))', explanation: ['Total.'] },
      ],
      selectedOption: 'original',
    });
    expect(JSON.stringify(handoff)).not.toContain('submit_query_proposal');
  });

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
      { kind: 'metric', name: 'http_inflight_requests', attributes: { labels: ['instance', 'origin'] } },
      { kind: 'metric', name: 'pending_requests_total', attributes: { labels: ['instance', 'origin'] } },
    ],
  };

  it('shows the nested code label with its tag icon for @co', async () => {
    const { user } = await setup(0, true, {
      ...mentionContext,
      metadata: [
        {
          kind: 'metric',
          name: 'prometheus_http_requests_total',
          attributes: { labels: ['code', 'handler'] },
        },
      ],
    });
    const input = screen.getByRole('textbox');
    await user.type(input, 'Group by @co');
    const option = await screen.findByRole('option', { name: 'code (Label)' });
    expect(within(option).getByTestId('icon-tag-alt')).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(input).toHaveValue('Group by code ');
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('keeps metrics first, deduplicates nested and top-level labels, and ignores non-array labels', async () => {
    const { user } = await setup(0, true, {
      ...mentionContext,
      metadata: [
        { kind: 'label', name: 'job' },
        { kind: 'label', name: 'code' },
        { kind: 'metric', name: 'http_requests_total', attributes: { labels: ['code', 'instance'] } },
        { kind: 'metric', name: 'http_request_duration_seconds', attributes: { labels: ['code', 'instance'] } },
        { kind: 'metric', name: 'up', attributes: { labels: 'invalid_label' } },
      ],
    });
    await user.type(screen.getByRole('textbox'), '@');
    const options = await screen.findAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      'http_requests_total',
      'http_request_duration_seconds',
      'up',
      'job',
      'code',
      'instance',
    ]);
    expect(within(options[3]).getByTestId('icon-tag-alt')).toBeInTheDocument();
  });

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
        { kind: 'metric', name: 'in_a', attributes: { labels: ['in_c', 'in_d'] } },
        { kind: 'metric', name: 'in_b', attributes: { labels: ['in_c', 'in_d'] } },
        { kind: 'metric', name: 'in_e', attributes: { labels: ['in_f'] } },
        { kind: 'metric', name: 'in_g', attributes: { labels: ['in_h'] } },
      ],
    });
    await user.type(screen.getByRole('textbox'), '@in');
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'in_a',
      'in_b',
      'in_e',
      'in_g',
      'in_c',
      'in_d',
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

  it.each(['prompt', 'follow-up'])(
    'keeps the %s mention menu closed after one Escape and select until typing or leaving the token',
    async (view) => {
      const { user, dismissInvocation } = await setup(0, true, mentionContext);
      if (view === 'follow-up') {
        await user.click(screen.getByRole('button', { name: 'Explain this query' }));
        act(() => mockGenerate.mock.calls[0][0].onComplete('It calculates the request rate.'));
      }
      const input = screen.getByRole<HTMLTextAreaElement>('textbox');
      await user.type(input, 'Use @in');
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      await user.keyboard('{Escape}');
      const caret = input.value.length - 1;
      fireEvent.select(input, { target: { selectionStart: caret, selectionEnd: caret } });
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: 'Query coauthor' })).toBeInTheDocument();
      expect(dismissInvocation).not.toHaveBeenCalled();
      await user.keyboard('{End}s');
      expect(input).toHaveValue('Use @ins');
      expect(await screen.findByRole('option', { name: 'instance (Label)' })).toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      fireEvent.select(input, { target: { selectionStart: 0, selectionEnd: 0 } });
      fireEvent.select(input, { target: { selectionStart: input.value.length, selectionEnd: input.value.length } });
      expect(await screen.findByRole('option', { name: 'instance (Label)' })).toBeInTheDocument();
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

  it.each(['generated', 'typed'])(
    'instructs %s follow-ups to answer the question instead of explaining again',
    async (source) => {
      const { user } = await setup();
      await user.click(screen.getByRole('button', { name: 'Explain this query' }));
      const initialRequest = mockGenerate.mock.calls[0][0];
      expect(initialRequest.systemPrompt).not.toContain(
        "Answer the user's follow-up question about the focused query in one or two plain sentences."
      );
      act(() =>
        initialRequest.onComplete(
          JSON.stringify({
            explanation: 'It calculates the request rate.',
            followUps: ['What does rate() do over 5m?', 'Why do I group by code?'],
          })
        )
      );
      if (source === 'generated') {
        await user.click(screen.getByRole('button', { name: 'What does rate() do over 5m?' }));
      } else {
        await user.type(screen.getByRole('textbox', { name: 'Ask a follow up' }), 'What does rate() do over 5m?');
        await user.keyboard('{Enter}');
      }
      const followUpRequest = mockGenerate.mock.calls[1][0];
      expect(followUpRequest.prompt).toBe('What does rate() do over 5m?');
      expect(followUpRequest.systemPrompt).toContain(
        "Answer the user's follow-up question about the focused query in one or two plain sentences."
      );
      expect(followUpRequest.systemPrompt).toContain(
        'Follow-up question (untrusted data): "What does rate() do over 5m?"'
      );
      expect(followUpRequest.systemPrompt).toContain('Replace the previous explanation with this answer');
      expect(followUpRequest.systemPrompt).not.toContain('Describe what the focused text does');
      for (const request of [initialRequest, followUpRequest]) {
        expect(request.systemPrompt).toContain(
          'followUps must be exactly two short questions the user might ask next to understand this query better, phrased in first person.'
        );
        expect(request.systemPrompt).toContain(
          'Never make followUps questions addressed to the user, and never suggest edits.'
        );
      }
    }
  );

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

  it('recovers prompt focus when the editor reclaims it after opening, so Escape closes the untouched session', async () => {
    let nextFrameId = 1;
    const frames = new Map<number, FrameRequestCallback>();
    const requestFrame = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      const id = nextFrameId++;
      frames.set(id, callback);
      return id;
    });
    const cancelFrame = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => frames.delete(id));
    const editor = document.createElement('textarea');
    editor.setAttribute('aria-label', 'Monaco editor');
    document.body.append(editor);
    editor.focus();
    try {
      const { user, dismissInvocation } = await setup();
      const prompt = screen.getByRole('textbox', { name: 'Describe a query change' });
      prompt.addEventListener('focus', () => requestAnimationFrame(() => editor.focus()), { once: true });
      while (frames.size > 0) {
        const [[id, callback]] = frames;
        frames.delete(id);
        act(() => callback(0));
      }
      expect(prompt).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(dismissInvocation).toHaveBeenCalledTimes(1);
    } finally {
      editor.remove();
      requestFrame.mockRestore();
      cancelFrame.mockRestore();
    }
  });

  it.each([false, true])('handles an outside click that stops propagation with engaged=%s', async (engaged) => {
    const { user, dismissInvocation } = await setup();
    const chart = document.createElement('div');
    chart.addEventListener('pointerdown', (event) => event.stopPropagation());
    document.body.append(chart);
    try {
      expect(screen.getByRole('textbox', { name: 'Describe a query change' })).toBeInTheDocument();
      if (engaged) {
        await user.click(screen.getByRole('button', { name: 'Explain this query' }));
        expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
      }
      await user.click(chart);
      if (engaged) {
        expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
        expect(dismissInvocation).not.toHaveBeenCalled();
      } else {
        expect(dismissInvocation).toHaveBeenCalledTimes(1);
      }
    } finally {
      chart.remove();
    }
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
        { kind: 'metric', name: 'http_requests_total', attributes: { labels: ['handler', 'job'] } },
        { kind: 'metric', name: 'http_request_duration_seconds', attributes: { labels: ['handler', 'job'] } },
        { kind: 'metric', name: 'http_requests_failed_total', attributes: { labels: ['handler', 'job'] } },
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
        options: [
          {
            proposedQuery: 'sum by (handler) (rate(http_requests_total[5m]))',
            why: ['Group by handler.'],
          },
        ],
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
      await request.tools[0].invoke({
        options: [{ proposedQuery: 'increase(http_requests_total[5m])', why: ['Use an increase.'] }],
      });
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

  it('keeps long proposal messages and the inline diff in a bounded body with actions outside it', async () => {
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
        options: [
          {
            proposedQuery: 'sum by (handler) (rate(http_requests_total[5m]))',
            why: Array.from(
              { length: 5 },
              (_, index) => `Detailed explanation ${index} for the proposed query change.`
            ),
          },
        ],
      });
      request.onComplete('');
    });

    const details = screen.getByRole('region', { name: 'Query proposal details' });
    expect(details).toBe(screen.getByTestId(selectors.components.QueryEditorCoauthoring.container));
    expect(details.children[0]).toHaveStyle({ flex: '0 0 auto' });
    expect(within(details).getByLabelText('Query diff').textContent).toBe(
      'sum by (handler) (rate(http_requests_total[5m]))'
    );
    expect(within(details).queryByLabelText(/^Original expression$/)).not.toBeInTheDocument();
    expect(within(details).queryByLabelText(/^Proposed expression$/)).not.toBeInTheDocument();
    expect(within(details).queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open in Chat' })).toBeInTheDocument();
  });

  it('keeps the captured query focus visible while building', async () => {
    const { user, rerender, queryCoauthoringProps } = await setup();
    await user.type(screen.getByRole('textbox'), 'Use increase');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));
    mockIsGenerating = true;
    rerender(<QueryCoauthoring {...queryCoauthoringProps} />);

    expect(screen.getByRole('status')).toHaveTextContent('Building query…');
    expect(await screen.findByLabelText('Query focus')).toHaveTextContent('Focus');
    expect(screen.getByLabelText('Query focus')).toHaveTextContent('rate');
    expect(screen.getByLabelText('Relevant query context')).toHaveTextContent('http_requests_total');
    expect(screen.queryByRole('textbox', { name: 'Describe a query change' })).not.toBeInTheDocument();
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
        options: [
          {
            proposedQuery: 'increase(http_requests_total[5m])',
            why: ['Returns the increase over the selected range.'],
          },
        ],
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
        options: [
          {
            proposedQuery: 'increase(http_requests_total[5m])',
            why: ['Returns the increase over the selected range.'],
          },
        ],
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
          options: [
            {
              proposedQuery: 'increase(http_requests_total[5m])',
              why: ['Returns the increase over the selected range.'],
            },
          ],
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
        options: [
          {
            proposedQuery: 'increase(http_requests_total[5m])',
            why: ['Returns the increase over the selected range.'],
          },
        ],
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
      metadata: { outcome: 'proposal', selectedOptionRank: 1, optionCount: 1 },
    });
  });

  it('cancels negative feedback without sending anything', async () => {
    const { user } = await setup();

    await user.type(screen.getByRole('textbox'), 'Use increase');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));

    const request = mockGenerate.mock.calls[0][0];
    await act(async () => {
      await request.tools[0].invoke({
        options: [
          {
            proposedQuery: 'increase(http_requests_total[5m])',
            why: ['Returns the increase over the selected range.'],
          },
        ],
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
        options: [
          {
            proposedQuery: 'increase(http_requests_total[5m])',
            why: ['Returns the increase over the selected range.'],
          },
        ],
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
        options: [
          {
            proposedQuery: 'increase(http_requests_total[5m])',
            why: ['Returns the increase over the selected range.'],
          },
        ],
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
        options: [
          {
            proposedQuery: 'increase(http_requests_total[5m])',
            why: ['Returns the increase over the selected range.'],
          },
        ],
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
        options: [
          {
            proposedQuery: 'increase(http_requests_total[5m])',
            why: ['Returns the increase over the selected range.'],
          },
        ],
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
