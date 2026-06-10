import { renderHook } from '@testing-library/react';

import { useAssistant, useInlineAssistant } from '@grafana/assistant';

import { type PulseBody } from '../types';

import { bodyTagsAssistant, useAssistantAutoReply } from './useAssistantAutoReply';

const mockUnwrap = jest.fn().mockResolvedValue(undefined);
const mockTrigger = jest.fn(() => ({ unwrap: mockUnwrap }));
jest.mock('../api/pulseApi', () => ({
  useAddAssistantReplyMutation: () => [mockTrigger, { isLoading: false }],
}));

// Captures the options passed to the inline assistant's generate(), so tests
// can assert on the prompt (context link + stripped question) it builds.
let lastGenerateOptions: { prompt: string } | undefined;
const mockGenerate = jest.fn(async (opts: { prompt: string; onComplete?: (text: string) => void }) => {
  lastGenerateOptions = opts;
  opts.onComplete?.('Generated answer');
});

const assistantBody: PulseBody = {
  root: {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: 'explain ' },
          { type: 'mention', mention: { kind: 'assistant', targetId: 'assistant', displayName: 'Grafana Assistant' } },
        ],
      },
    ],
  },
  markdown: 'explain `@Grafana Assistant`',
};

const plainBody: PulseBody = {
  root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'hi' }] }] },
};

describe('bodyTagsAssistant', () => {
  it('detects @assistant mentions', () => {
    expect(bodyTagsAssistant(assistantBody)).toBe(true);
    expect(bodyTagsAssistant(plainBody)).toBe(false);
  });
});

describe('useAssistantAutoReply', () => {
  beforeEach(() => {
    mockTrigger.mockClear();
    mockUnwrap.mockClear();
    mockGenerate.mockClear();
    lastGenerateOptions = undefined;
    jest.mocked(useAssistant).mockReturnValue({
      isLoading: false,
      isAvailable: true,
      openAssistant: jest.fn(),
      closeAssistant: jest.fn(),
      toggleAssistant: jest.fn(),
    });
    jest.mocked(useInlineAssistant).mockReturnValue({
      generate: mockGenerate,
      isGenerating: false,
      content: '',
      error: null,
      cancel: jest.fn(),
      reset: jest.fn(),
    });
  });

  it('does nothing when the body does not tag the assistant', async () => {
    const { result } = renderHook(() => useAssistantAutoReply());
    await result.current(plainBody, { threadUID: 't1' });
    expect(mockTrigger).not.toHaveBeenCalled();
  });

  it('generates and posts the assistant answer when available', async () => {
    const { result } = renderHook(() => useAssistantAutoReply());
    await result.current(assistantBody, { threadUID: 't1', parentUID: 'p1' });
    expect(mockTrigger).toHaveBeenCalledWith({
      threadUID: 't1',
      req: { parentUID: 'p1', markdown: 'Generated answer' },
    });
  });

  it('includes a dashboard/panel link in the prompt so the assistant can inspect it', async () => {
    const { result } = renderHook(() => useAssistantAutoReply());
    await result.current(assistantBody, {
      threadUID: 't1',
      dashboardUID: 'dash-uid',
      dashboardTitle: 'My dashboard',
      panelId: 4,
      panelTitle: 'Latency',
    });
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    const prompt = lastGenerateOptions?.prompt ?? '';
    expect(prompt).toContain('d/dash-uid?viewPanel=4');
    expect(prompt).toContain('Latency');
    // The @assistant chip text is stripped from the question.
    expect(prompt).not.toContain('@Grafana Assistant');
    expect(prompt).toContain('explain');
  });

  it('uses the drawer panel scope (fallbackPanelId) when nothing more explicit is present', async () => {
    const { result } = renderHook(() => useAssistantAutoReply());
    await result.current(assistantBody, {
      threadUID: 't1',
      dashboardUID: 'dash-uid',
      fallbackPanelId: 9,
      panelTitlesById: new Map([[9, 'Error rate']]),
    });
    const prompt = lastGenerateOptions?.prompt ?? '';
    expect(prompt).toContain('viewPanel=9');
    expect(prompt).toContain('Error rate');
  });

  it('names the panel by its current title from the live title map', async () => {
    const { result } = renderHook(() => useAssistantAutoReply());
    await result.current(assistantBody, {
      threadUID: 't1',
      dashboardUID: 'dash-uid',
      panelId: 4,
      // A stale explicit title is overridden by the live map.
      panelTitle: 'Old name',
      panelTitlesById: new Map([[4, 'Tail latency']]),
    });
    const prompt = lastGenerateOptions?.prompt ?? '';
    expect(prompt).toContain('Tail latency');
    expect(prompt).not.toContain('Old name');
  });

  it('posts a fallback notice when the assistant is unavailable', async () => {
    jest.mocked(useAssistant).mockReturnValue({
      isLoading: false,
      isAvailable: false,
      openAssistant: undefined,
      closeAssistant: jest.fn(),
      toggleAssistant: jest.fn(),
    });
    const { result } = renderHook(() => useAssistantAutoReply());
    await result.current(assistantBody, { threadUID: 't1' });
    expect(mockTrigger).toHaveBeenCalledTimes(1);
    expect(mockTrigger).toHaveBeenCalledWith(
      expect.objectContaining({
        threadUID: 't1',
        req: expect.objectContaining({ markdown: expect.stringContaining('Grafana Assistant') }),
      })
    );
  });
});
