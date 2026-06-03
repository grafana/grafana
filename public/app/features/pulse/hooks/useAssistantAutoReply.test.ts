import { renderHook } from '@testing-library/react';

import { useAssistant, useInlineAssistant } from '@grafana/assistant';

import { type PulseBody } from '../types';

import { bodyTagsAssistant, useAssistantAutoReply } from './useAssistantAutoReply';

const mockUnwrap = jest.fn().mockResolvedValue(undefined);
const mockTrigger = jest.fn(() => ({ unwrap: mockUnwrap }));
jest.mock('../api/pulseApi', () => ({
  useAddAssistantReplyMutation: () => [mockTrigger, { isLoading: false }],
}));

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
    jest.mocked(useAssistant).mockReturnValue({
      isLoading: false,
      isAvailable: true,
      openAssistant: jest.fn(),
      closeAssistant: jest.fn(),
      toggleAssistant: jest.fn(),
    });
    jest.mocked(useInlineAssistant).mockReturnValue({
      generate: jest.fn(async (opts) => {
        opts.onComplete?.('Generated answer');
      }),
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
