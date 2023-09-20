import { llms } from '@grafana/experimental';

import {
  generateTextWithLLM,
  isLLMPluginEnabled,
  isResponseCompleted,
  cleanupResponse,
  Role,
  DONE_MESSAGE,
  OPEN_AI_MODEL,
} from './utils';

// Mock the llms.openai module
jest.mock('@grafana/experimental', () => ({
  llms: {
    openai: {
      streamChatCompletions: jest.fn(),
      accumulateContent: jest.fn(),
      enabled: jest.fn(),
    },
  },
}));

describe('generateTextWithLLM', () => {
  it('should throw an error if LLM plugin is not enabled', async () => {
    jest.mocked(llms.openai.enabled).mockResolvedValue(false);

    await expect(generateTextWithLLM([{ role: Role.user, content: 'Hello' }], jest.fn())).rejects.toThrow(
      'LLM plugin is not enabled'
    );
  });

  it('should call llms.openai.streamChatCompletions with the correct parameters', async () => {
    // Mock llms.openai.enabled to return true
    jest.mocked(llms.openai.enabled).mockResolvedValue(true);

    // Mock llms.openai.streamChatCompletions to return a mock observable (types not exported from library)
    const mockObservable = { pipe: jest.fn().mockReturnValue({ subscribe: jest.fn() }) } as unknown as ReturnType<
      typeof llms.openai.streamChatCompletions
    >;
    jest.mocked(llms.openai.streamChatCompletions).mockReturnValue(mockObservable);

    const messages = [{ role: Role.user, content: 'Hello' }];
    const onReply = jest.fn();

    await generateTextWithLLM(messages, onReply);

    expect(llms.openai.streamChatCompletions).toHaveBeenCalledWith({
      model: OPEN_AI_MODEL,
      messages: [
        // It will always includes the DONE_MESSAGE by default as the first message
        DONE_MESSAGE,
        ...messages,
      ],
    });
  });
});

describe('isLLMPluginEnabled', () => {
  it('should return true if LLM plugin is enabled', async () => {
    // Mock llms.openai.enabled to return true
    jest.mocked(llms.openai.enabled).mockResolvedValue(true);

    const enabled = await isLLMPluginEnabled();

    expect(enabled).toBe(true);
  });

  it('should return false if LLM plugin is not enabled', async () => {
    // Mock llms.openai.enabled to return false
    jest.mocked(llms.openai.enabled).mockResolvedValue(false);

    const enabled = await isLLMPluginEnabled();

    expect(enabled).toBe(false);
  });
});

describe('isResponseCompleted', () => {
  it('should return true if response ends with the special done token', () => {
    const response = 'This is a response¬';

    const completed = isResponseCompleted(response);

    expect(completed).toBe(true);
  });

  it('should return false if response does not end with the special done token', () => {
    const response = 'This is a response';

    const completed = isResponseCompleted(response);

    expect(completed).toBe(false);
  });
});

describe('cleanupResponse', () => {
  it('should remove the special done token and quotes from the response', () => {
    const response = 'This is a "response¬"';

    const cleanedResponse = cleanupResponse(response);

    expect(cleanedResponse).toBe('This is a response');
  });
});
