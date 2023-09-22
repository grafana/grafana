import { llms } from '@grafana/experimental';

import { createDashboardModelFixture, createPanelJSONFixture } from '../../state/__fixtures__/dashboardFixtures';

import {
  generateTextWithLLM,
  isLLMPluginEnabled,
  isResponseCompleted,
  cleanupResponse,
  Role,
  DONE_MESSAGE,
  OPEN_AI_MODEL,
  getDashboardChanges,
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
    const temperature = 0.5;

    await generateTextWithLLM(messages, onReply, temperature);

    expect(llms.openai.streamChatCompletions).toHaveBeenCalledWith({
      model: OPEN_AI_MODEL,
      messages: [
        // It will always includes the DONE_MESSAGE by default as the first message
        DONE_MESSAGE,
        ...messages,
      ],
      temperature,
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

describe('getDashboardChanges', () => {
  it('should correctly split user changes and migration changes', () => {
    // Mock data for testing
    const deprecatedOptions = {
      legend: { displayMode: 'hidden', showLegend: false },
    };
    const deprecatedVersion = 37;
    const dashboard = createDashboardModelFixture({
      schemaVersion: deprecatedVersion,
      panels: [createPanelJSONFixture({ title: 'Panel 1', options: deprecatedOptions })],
    });

    // Update title for the first panel
    dashboard.updatePanels([
      {
        ...dashboard.panels[0],
        title: 'New title',
      },
      ...dashboard.panels.slice(1),
    ]);

    // Call the function to test
    const result = getDashboardChanges(dashboard);

    // Assertions
    expect(result.userChanges).toEqual({
      panels: [
        {
          op: 'replace',
          originalValue: 'Panel 1',
          value: 'New title',
          startLineNumber: expect.any(Number),
          path: ['panels', '0', 'title'],
        },
      ],
    });
    expect(result.migrationChanges).toBeDefined();
    expect(result.userChanges).not.toContain({
      panels: [
        {
          op: 'replace',
          originalValue: 'Panel 1',
          value: 'New title',
          startLineNumber: expect.any(Number),
          path: ['panels', '0', 'title'],
        },
      ],
    });
  });
});
