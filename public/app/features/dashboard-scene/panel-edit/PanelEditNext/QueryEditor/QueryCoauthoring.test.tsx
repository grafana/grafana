import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type QueryEditorCoauthoringCapability, type QueryEditorCoauthoringInvocation } from '@grafana/data';

import { QueryCoauthoring } from './QueryCoauthoring';

const mockGenerate = jest.fn().mockResolvedValue(undefined);
const mockCancel = jest.fn();
const mockReset = jest.fn();
const mockOpenAssistant = jest.fn();
const mockPost = jest.fn();
const VIEWPORT_TEST_MARGIN = 8;
let mockIsGenerating = false;
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
}));

async function setup(anchorTop = 0, waitForPrompt = true) {
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
  await act(async () => invocationListener?.({ anchorElement, dismiss: dismissInvocation }));
  if (waitForPrompt) {
    await screen.findByRole('textbox', { name: 'Describe a query change' });
  }

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
    mockPost.mockResolvedValue({ id: 'feedback-id' });
    mockIsGenerating = false;
    mockAssistantAvailable = true;
    mockAssistantLoading = false;
  });

  it('shows the selected metric context using the Figma Looks like treatment', async () => {
    await setup();

    expect(await screen.findByText('Looks like: http_requests_total is a counter metric.')).toBeInTheDocument();
  });

  it('shows an explicit dismissal path when Assistant is unavailable', async () => {
    mockAssistantAvailable = false;
    const { user, dismissInvocation, focus } = await setup(0, false);

    expect(await screen.findByText('Assistant is not available')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Describe a query change' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(dismissInvocation).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
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

  it('cancels an in-flight build and ignores a late proposal', async () => {
    const { user, capability, stagePreview, onAccept, rerender } = await setup();

    await user.type(screen.getByRole('textbox'), 'Use increase');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));
    const request = mockGenerate.mock.calls[0][0];

    mockIsGenerating = true;
    rerender(<QueryCoauthoring capability={capability} onAccept={onAccept} />);
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

  it('treats an empty completion without a terminal tool result as a request failure', async () => {
    const { user } = await setup();

    await user.type(screen.getByRole('textbox'), 'Use increase');
    await user.click(screen.getByRole('button', { name: 'Coauthor' }));

    act(() => mockGenerate.mock.calls[0][0].onComplete(''));

    expect(screen.getByText(/could not build a query proposal/i)).toBeInTheDocument();
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
