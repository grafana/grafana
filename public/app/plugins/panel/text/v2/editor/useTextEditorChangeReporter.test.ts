import { renderHook } from '@testing-library/react';

import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';

import { CodeLanguage, type Options, TextMode } from '../../panelcfg.gen';

import { getChangedTextEditorOptions, useTextEditorChangeReporter } from './useTextEditorChangeReporter';

const options: Options = {
  mode: TextMode.Markdown,
  content: '# Revenue notes',
  code: { language: CodeLanguage.Plaintext, showLineNumbers: false, showMiniMap: false },
};

describe('getChangedTextEditorOptions', () => {
  it('returns nothing when the change matches the options', () => {
    expect(getChangedTextEditorOptions(options, { content: '# Revenue notes' })).toEqual([]);
  });

  it.each([
    { name: 'content', change: { content: '# Cost notes' }, expected: ['content'] },
    { name: 'mode', change: { content: '# Revenue notes', mode: TextMode.HTML }, expected: ['mode'] },
    {
      name: 'code language and line numbers',
      change: { content: '# Revenue notes', codeLanguage: CodeLanguage.Sql, showLineNumbers: true },
      expected: ['code.language', 'code.showLineNumbers'],
    },
  ])('returns $expected when $name changes', ({ change, expected }) => {
    expect(getChangedTextEditorOptions(options, change).map(({ option }) => option)).toEqual(expected);
  });
});

describe('useTextEditorChangeReporter', () => {
  let setVisualOption: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    setVisualOption = jest.spyOn(DashboardInteractions, 'setVisualOption').mockImplementation();
  });

  afterEach(() => {
    jest.useRealTimers();
    setVisualOption.mockRestore();
  });

  it('reports a mode change with its value', () => {
    const { result } = renderHook(() => useTextEditorChangeReporter(4));

    result.current(options, { content: '# Revenue notes', mode: TextMode.HTML });

    expect(setVisualOption).toHaveBeenCalledWith({
      ui: 'text-panel-editor',
      option: 'mode',
      value: '"html"',
      value_type: 'string',
      panel_type: 'text',
      panel_id: 4,
    });
  });

  it('reports a run of content edits once, after two seconds, without the content', () => {
    const { result } = renderHook(() => useTextEditorChangeReporter(4));

    result.current(options, { content: '# Revenue notes for Q3' });
    jest.advanceTimersByTime(1000);
    result.current(options, { content: '# Revenue notes for Q4' });
    expect(setVisualOption).not.toHaveBeenCalled();
    jest.advanceTimersByTime(2000);

    expect(setVisualOption).toHaveBeenCalledTimes(1);
    expect(setVisualOption).toHaveBeenCalledWith({
      ui: 'text-panel-editor',
      option: 'content',
      value_type: 'string',
      panel_type: 'text',
      panel_id: 4,
    });
    expect(JSON.stringify(setVisualOption.mock.calls)).not.toContain('Revenue');
  });

  it('sends a pending content report when the editor unmounts', () => {
    const { result, unmount } = renderHook(() => useTextEditorChangeReporter(4));

    result.current(options, { content: '# Cost notes' });
    unmount();

    expect(setVisualOption).toHaveBeenCalledTimes(1);
    expect(setVisualOption).toHaveBeenCalledWith(expect.objectContaining({ option: 'content' }));
  });
});
