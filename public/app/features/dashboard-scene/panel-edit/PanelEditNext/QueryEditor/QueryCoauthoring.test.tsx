import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type QueryEditorCoauthoringCapability, type QueryEditorCoauthoringInvocation } from '@grafana/data';

import { QueryCoauthoring } from './QueryCoauthoring';

const mockGenerate = jest.fn().mockResolvedValue(undefined);
const mockCancel = jest.fn();
const mockReset = jest.fn();
const mockOpenAssistant = jest.fn();
const VIEWPORT_TEST_MARGIN = 8;

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
  useInlineAssistant: () => ({
    generate: mockGenerate,
    isGenerating: false,
    content: '',
    error: null,
    cancel: mockCancel,
    reset: mockReset,
  }),
}));

async function setup(anchorTop = 0) {
  const focus = jest.fn();
  const clearPreview = jest.fn();
  const stagePreview = jest.fn(() => ({
    changes: [
      {
        id: 'change-1',
        focus: 'inside' as const,
        original: 'rate',
        proposed: 'increase',
        kind: 'function' as const,
      },
    ],
  }));
  const dismissInvocation = jest.fn();
  const onAccept = jest.fn();
  let invocationListener: ((invocation: QueryEditorCoauthoringInvocation) => void) | undefined;
  const capability: QueryEditorCoauthoringCapability = {
    getValue: jest.fn(() => 'rate(http_requests_total[5m])'),
    getContext: jest.fn().mockResolvedValue({
      query: 'rate(http_requests_total[5m])',
      focusRanges: [{ from: 0, to: 4 }],
      metricMetadata: [
        {
          name: 'http_requests_total',
          type: 'counter',
          help: 'Total HTTP requests.',
        },
      ],
    }),
    createQuery: (value) => ({ refId: 'A', expr: value }),
    validateQuery: jest.fn(() => true),
    stagePreview,
    clearPreview,
    subscribeToInvocation: (listener) => {
      invocationListener = listener;
      return () => {
        invocationListener = undefined;
      };
    },
    focus,
  };
  const anchorElement = document.createElement('div');
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

  const result = render(<QueryCoauthoring capability={capability} onAccept={onAccept} />);
  act(() => invocationListener?.({ anchorElement, dismiss: dismissInvocation }));
  await screen.findByRole('textbox', { name: 'Describe a query change' });

  return {
    capability,
    clearPreview,
    dismissInvocation,
    focus,
    onAccept,
    stagePreview,
    user: userEvent.setup(),
    ...result,
  };
}

describe('QueryCoauthoring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends only the full query, focused text, and relevant metric metadata', async () => {
    const { user, capability } = await setup();

    await user.type(screen.getByRole('textbox'), 'Show the total count instead');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));

    const request = mockGenerate.mock.calls[0][0];
    expect(request).toMatchObject({
      origin: 'grafana/panel-edit-next/query-coauthoring',
      agentName: 'promql-coauthor',
      agentId: 'grafana.query.coauthor.v1',
      prompt: 'Show the total count instead',
    });
    expect(request.systemPrompt).toContain(JSON.stringify(capability.getValue()));
    expect(request.systemPrompt).toContain('Focused text: ["rate"]');
    expect(request.systemPrompt).toContain('http_requests_total');
    expect(request.systemPrompt).toContain('counter');
    expect(request.systemPrompt).not.toContain('dashboardTitle');
  });

  it('stages a validated proposal in the editor and applies it only after acceptance', async () => {
    const { user, stagePreview, onAccept, clearPreview, dismissInvocation } = await setup();

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
    expect(screen.getByText('Returns the increase over the selected range.')).toBeInTheDocument();
    expect(screen.getByText('increase')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Accept' }));

    expect(clearPreview).toHaveBeenCalled();
    expect(dismissInvocation).toHaveBeenCalled();
    expect(onAccept).toHaveBeenCalledWith({
      refId: 'A',
      expr: 'increase(http_requests_total[5m])',
    });
  });

  it('constrains the popover to the viewport below its editor anchor', async () => {
    await setup(500);

    expect(screen.getByRole('dialog', { name: 'Query coauthor' })).toHaveStyle({
      maxHeight: `${window.innerHeight - 500 - VIEWPORT_TEST_MARGIN}px`,
    });
  });

  it('rejects a proposal when the baseline query changes during generation', async () => {
    const { user, capability, stagePreview, onAccept } = await setup();

    await user.type(screen.getByRole('textbox'), 'Use increase');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));

    const request = mockGenerate.mock.calls[0][0];
    await request.tools[0].invoke({
      proposedQuery: 'increase(http_requests_total[5m])',
      why: ['Returns the increase over the selected range.'],
    });
    jest.mocked(capability.getValue).mockReturnValue('rate(http_requests_total[10m])');

    act(() => request.onComplete(''));

    expect(screen.getByText(/query changed while assistant was working/i)).toBeInTheDocument();
    expect(stagePreview).not.toHaveBeenCalled();
    expect(onAccept).not.toHaveBeenCalled();
  });

  it('surfaces a completion without a terminal tool result or clarification', async () => {
    const { user } = await setup();

    await user.type(screen.getByRole('textbox'), 'Use increase');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));

    act(() => mockGenerate.mock.calls[0][0].onComplete(''));

    expect(screen.getByText(/returned no query proposal/i)).toBeInTheDocument();
  });

  it('returns invalid PromQL to the tool loop so Assistant can repair it', async () => {
    const { user, capability, stagePreview } = await setup();
    jest.mocked(capability.validateQuery).mockReturnValueOnce(false).mockReturnValue(true);

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
    const { user, capability } = await setup();
    jest.mocked(capability.validateQuery).mockReturnValue(false);

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

  it('offers a bounded handoff when the request is too broad for one query', async () => {
    const { user } = await setup();

    await user.type(screen.getByRole('textbox'), 'Update all queries in this dashboard');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));

    const request = mockGenerate.mock.calls[0][0];
    await act(async () => {
      await request.tools[1].invoke({ reason: 'This change spans other queries.' });
      request.onComplete('');
    });

    expect(screen.getByText('This change spans other queries.')).toBeInTheDocument();
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

  it('surfaces request errors with retry and dismissal paths', async () => {
    const { user, dismissInvocation } = await setup();

    await user.type(screen.getByRole('textbox'), 'Use increase');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));
    act(() => mockGenerate.mock.calls[0][0].onError(new Error('request failed')));

    expect(screen.getByText(/could not build a query proposal/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.queryByText(/could not build a query proposal/i)).not.toBeInTheDocument();

    act(() => mockGenerate.mock.calls[0][0].onError(new Error('request failed')));
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(dismissInvocation).toHaveBeenCalled();
  });

  it('dismisses on Escape without applying and restores focus to the editor', async () => {
    const { user, focus, onAccept, dismissInvocation } = await setup();

    await user.keyboard('{Escape}');

    expect(onAccept).not.toHaveBeenCalled();
    expect(mockCancel).toHaveBeenCalled();
    expect(dismissInvocation).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Query coauthor' })).not.toBeInTheDocument();
  });
});
