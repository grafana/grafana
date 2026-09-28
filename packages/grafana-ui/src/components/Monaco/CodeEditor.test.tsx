import { render } from '@testing-library/react';

import { createTheme, monacoLanguageRegistry } from '@grafana/data';

import { mockThemeContext } from '../../themes/ThemeContext';

import { CodeEditor } from './CodeEditor';
import type { ReactMonacoEditorProps } from './types';

let capturedEditorProps: ReactMonacoEditorProps | undefined;

jest.mock('./ReactMonacoEditorLazy', () => ({
  ReactMonacoEditorLazy: (props: ReactMonacoEditorProps) => {
    capturedEditorProps = props;
    return null;
  },
}));

describe('CodeEditor', () => {
  let restoreThemeContext: () => void;

  beforeAll(() => {
    monacoLanguageRegistry.register({
      id: 'kusto',
      name: 'Kusto',
      editorOptions: { 'semanticHighlighting.enabled': true },
      init: () => ({}) as Worker,
    });
  });

  beforeEach(() => {
    capturedEditorProps = undefined;
    restoreThemeContext = mockThemeContext(createTheme());
  });

  afterEach(() => {
    restoreThemeContext();
  });

  it('enables semantic highlighting for registered Kusto editors', () => {
    render(<CodeEditor value="" language="kusto" />);

    expect(capturedEditorProps?.options).toEqual(expect.objectContaining({ 'semanticHighlighting.enabled': true }));
  });

  it('uses an explicit semantic highlighting setting instead of the language default', () => {
    render(<CodeEditor value="" language="kusto" monacoOptions={{ 'semanticHighlighting.enabled': false }} />);

    expect(capturedEditorProps?.options).toEqual(expect.objectContaining({ 'semanticHighlighting.enabled': false }));
  });
});
