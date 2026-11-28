import { type AppPluginConfig } from '@grafana/data';
import { llm } from '@grafana/llm';
import { setAppPluginMetas } from '@grafana/runtime/internal';

import { createDashboardModelFixture, createPanelSaveModel } from '../../state/__fixtures__/dashboardFixtures';
import { NEW_PANEL_TITLE } from '../../utils/dashboard';

import { getDashboardPanelPrompt, getPanelStrings, isLLMPluginEnabled, sanitizeReply } from './utils';

// Mock the llm module
jest.mock('@grafana/llm', () => ({
  ...jest.requireActual('@grafana/llm'),
  llm: {
    streamChatCompletions: jest.fn(),
    accumulateContent: jest.fn(),
    health: jest.fn(),
    Model: { LARGE: 'large' },
  },
}));

describe('isLLMPluginEnabled', () => {
  beforeEach(() => {
    setAppPluginMetas({ 'grafana-llm-app': {} as AppPluginConfig });
  });

  it('should return false if LLM plugin is not enabled', async () => {
    // Mock llm.health to return false
    jest.mocked(llm.health).mockResolvedValue({ ok: false, configured: false });

    const enabled = await isLLMPluginEnabled();

    expect(enabled).toBe(false);
  });

  it('should return true if LLM plugin is enabled', async () => {
    // Mock llm.health to return true
    jest.mocked(llm.health).mockResolvedValue({ ok: true, configured: false });

    const enabled = await isLLMPluginEnabled();

    expect(enabled).toBe(true);
  });
});

describe('sanitizeReply', () => {
  it('should remove quotes from the beginning and end of a string', () => {
    expect(sanitizeReply('"Hello, world!"')).toBe('Hello, world!');
  });

  it('should not remove quotes from the middle of a string', () => {
    expect(sanitizeReply('Hello, "world"!')).toBe('Hello, "world"!');
  });

  it('should only remove quotes if they are at the beginning or end of a string, and not in the middle', () => {
    expect(sanitizeReply('"Hello", world!')).toBe('Hello", world!');
  });

  it('should return an empty string if given an empty string', () => {
    expect(sanitizeReply('')).toBe('');
  });
});

describe('getPanelStrings', () => {
  function dashboardSetup(items: Array<{ title: string; description: string }>) {
    return createDashboardModelFixture({
      panels: items.map((item) => createPanelSaveModel(item)),
    });
  }

  it('should return an empty array if all panels dont have title or descriptions', () => {
    const dashboard = dashboardSetup([{ title: '', description: '' }]);

    expect(getPanelStrings(dashboard)).toEqual([]);
  });

  it('should return an empty array if all panels have no description and panels that have title are titled "Panel title', () => {
    const dashboard = dashboardSetup([{ title: NEW_PANEL_TITLE, description: '' }]);

    expect(getPanelStrings(dashboard)).toEqual([]);
  });

  it('should return an array of panels if a panel has a title or description', () => {
    const dashboard = dashboardSetup([
      { title: 'Graph panel', description: '' },
      { title: '', description: 'Logs' },
    ]);

    expect(getPanelStrings(dashboard)).toEqual([
      '- Panel 0\n- Title: Graph panel',
      '- Panel 1\n- Title: \n- Description: Logs',
    ]);
  });

  it('returns an array with title and description if both are present', () => {
    const dashboard = dashboardSetup([
      { title: 'Graph panel', description: 'Logs' },
      { title: 'Table panel', description: 'Metrics' },
    ]);

    expect(getPanelStrings(dashboard)).toEqual([
      '- Panel 0\n- Title: Graph panel\n- Description: Logs',
      '- Panel 1\n- Title: Table panel\n- Description: Metrics',
    ]);
  });
});

describe('getDashboardPanelPrompt', () => {
  function dashboardSetup(items: Array<{ title: string; description?: string }>) {
    return createDashboardModelFixture({
      panels: items.map((item) => createPanelSaveModel(item)),
    });
  }

  function panels(prefix: string, count: number, description?: string) {
    return Array.from({ length: count }, (_, i) => ({ title: `${prefix} ${i}`, description }));
  }

  function presentedTitles(prompt: string) {
    return prompt
      .split('\n')
      .filter((line) => line.startsWith('- Title: '))
      .map((line) => line.slice('- Title: '.length));
  }

  it.each([
    {
      name: 'every panel when there are ten or fewer',
      items: panels('Plain', 8),
      expected: ['Plain 0', 'Plain 1', 'Plain 2', 'Plain 3', 'Plain 4', 'Plain 5', 'Plain 6', 'Plain 7'],
    },
    {
      name: 'the first ten panels with descriptions when more than ten have one',
      items: [...panels('Described', 15, 'Shows load'), ...panels('Plain', 5)],
      expected: [
        'Described 0',
        'Described 1',
        'Described 2',
        'Described 3',
        'Described 4',
        'Described 5',
        'Described 6',
        'Described 7',
        'Described 8',
        'Described 9',
      ],
    },
    {
      name: 'panels with descriptions first, then the first panels without descriptions up to ten',
      items: [...panels('Plain', 27), ...panels('Described', 3, 'Shows load')],
      expected: [
        'Described 0',
        'Described 1',
        'Described 2',
        'Plain 0',
        'Plain 1',
        'Plain 2',
        'Plain 3',
        'Plain 4',
        'Plain 5',
        'Plain 6',
      ],
    },
    {
      name: 'ten panels when there are just over ten',
      items: panels('Plain', 12),
      expected: [
        'Plain 0',
        'Plain 1',
        'Plain 2',
        'Plain 3',
        'Plain 4',
        'Plain 5',
        'Plain 6',
        'Plain 7',
        'Plain 8',
        'Plain 9',
      ],
    },
  ])('presents $name', ({ items, expected }) => {
    expect(presentedTitles(getDashboardPanelPrompt(dashboardSetup(items)))).toEqual(expected);
  });
});
