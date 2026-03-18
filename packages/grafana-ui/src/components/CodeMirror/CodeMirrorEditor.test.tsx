import { Extension } from '@codemirror/state';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import * as React from 'react';

import { createTheme, GrafanaTheme2 } from '@grafana/data';

import { CodeMirrorEditor } from './CodeMirrorEditor';
import { createGenericHighlighter } from './highlight';
import { createGenericTheme } from './styles';
import { HighlighterFactory, SyntaxHighlightConfig, ThemeFactory } from './types';

// Mock DOM elements required by CodeMirror
beforeAll(() => {
  Range.prototype.getClientRects = jest.fn(() => ({
    item: () => null,
    length: 0,
    [Symbol.iterator]: jest.fn(),
  }));
  Range.prototype.getBoundingClientRect = jest.fn(() => ({
    x: 0,
    y: 0,
    bottom: 0,
    height: 0,
    left: 0,
    right: 0,
    top: 0,
    width: 0,
    toJSON: () => {},
  }));
});

describe('CodeMirrorEditor', () => {
  it('renders a .cm-editor element in the DOM', async () => {
    render(<CodeMirrorEditor value="Hello World" onChange={jest.fn()} />);
    await waitFor(() => {
      expect(document.querySelector('.cm-editor')).toBeInTheDocument();
    });
  });

  it('placeholder prop shows as aria-placeholder on .cm-content', async () => {
    render(<CodeMirrorEditor value="" onChange={jest.fn()} placeholder="Enter text here" />);
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-placeholder', 'Enter text here');
    });
  });

  it('ariaLabel prop sets aria-label on .cm-content (the textbox)', async () => {
    render(<CodeMirrorEditor value="" onChange={jest.fn()} ariaLabel="Code editor" />);
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-label', 'Code editor');
    });
  });

  it('onChange called when user types', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    render(<CodeMirrorEditor value="" onChange={onChange} />);
    await user.click(await screen.findByRole('textbox'));
    await user.keyboard('test');
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });

  it('external value prop change updates the doc', async () => {
    const onChange = jest.fn();

    function Wrapper({ val }: { val: string }) {
      return <CodeMirrorEditor value={val} onChange={onChange} />;
    }

    const { rerender } = render(<Wrapper val="first" />);
    expect(await screen.findByRole('textbox')).toBeInTheDocument();

    rerender(<Wrapper val="second" />);
    expect(await screen.findByRole('textbox')).toBeInTheDocument();
  });

  it('external value matching current doc does not trigger onChange', async () => {
    const onChange = jest.fn();

    function Wrapper({ val }: { val: string }) {
      return <CodeMirrorEditor value={val} onChange={onChange} />;
    }

    const { rerender } = render(<Wrapper val="same" />);
    expect(await screen.findByRole('textbox')).toBeInTheDocument();

    onChange.mockClear();
    rerender(<Wrapper val="same" />);
    // Give any async effects time to fire
    await new Promise((r) => setTimeout(r, 50));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('custom className applied to container div', async () => {
    render(<CodeMirrorEditor value="" onChange={jest.fn()} className="my-custom" />);
    await waitFor(() => {
      expect(document.querySelector('.my-custom')).toBeInTheDocument();
    });
  });

  it('autocompletion prop can be changed without errors', async () => {
    const ext1: Extension = [];
    const ext2: Extension = [];

    function Wrapper({ ext }: { ext: Extension }) {
      return <CodeMirrorEditor value="" onChange={jest.fn()} autocompletion={ext} />;
    }

    const { rerender } = render(<Wrapper ext={ext1} />);
    expect(await screen.findByRole('textbox')).toBeInTheDocument();
    // Should not throw
    rerender(<Wrapper ext={ext2} />);
    expect(await screen.findByRole('textbox')).toBeInTheDocument();
  });

  it('renders with custom theme factory', async () => {
    const customTheme: ThemeFactory = (theme) => createGenericTheme(theme);
    render(<CodeMirrorEditor value="test" onChange={jest.fn()} themeFactory={customTheme} />);
    await waitFor(() => expect(document.querySelector('.cm-editor')).toBeInTheDocument());
  });

  it('renders with highlightConfig', async () => {
    const highlightConfig: SyntaxHighlightConfig = { pattern: /\$\{[^}]+}/g, className: 'variable-highlight' };
    render(<CodeMirrorEditor value="${test}" onChange={jest.fn()} highlightConfig={highlightConfig} />);
    expect(await screen.findByRole('textbox')).toBeInTheDocument();
  });

  it('renders with custom highlighterFactory', async () => {
    const customHighlighter: HighlighterFactory = (config) => (config ? createGenericHighlighter(config) : []);
    const highlightConfig: SyntaxHighlightConfig = { pattern: /\btest\b/g, className: 'keyword' };
    render(
      <CodeMirrorEditor
        value="test keyword"
        onChange={jest.fn()}
        highlighterFactory={customHighlighter}
        highlightConfig={highlightConfig}
      />
    );
    expect(await screen.findByRole('textbox')).toBeInTheDocument();
  });

  it('theme factory updates do not throw', async () => {
    const theme1: ThemeFactory = (theme) => createGenericTheme(theme);
    const theme2: ThemeFactory = () => {
      const t = createTheme({ colors: { mode: 'dark' } });
      return createGenericTheme(t);
    };

    function Wrapper({ tf }: { tf: ThemeFactory }) {
      return <CodeMirrorEditor value="test" onChange={jest.fn()} themeFactory={tf} />;
    }

    const { rerender } = render(<Wrapper tf={theme1} />);
    expect(await screen.findByRole('textbox')).toBeInTheDocument();
    rerender(<Wrapper tf={theme2} />);
    expect(await screen.findByRole('textbox')).toBeInTheDocument();
  });

  it('renders with both custom theme and highlighter', async () => {
    const customTheme: ThemeFactory = (theme: GrafanaTheme2) => createGenericTheme(theme);
    const highlightConfig: SyntaxHighlightConfig = { pattern: /\$\{[^}]+}/g, className: 'variable' };
    render(
      <CodeMirrorEditor
        value="${variable} test"
        onChange={jest.fn()}
        themeFactory={customTheme}
        highlightConfig={highlightConfig}
      />
    );
    expect(await screen.findByRole('textbox')).toBeInTheDocument();
  });

  it('renders with showLineNumbers', async () => {
    render(<CodeMirrorEditor value="Line 1\nLine 2" onChange={jest.fn()} showLineNumbers={true} />);
    expect(await screen.findByRole('textbox')).toBeInTheDocument();
  });

  it('renders with useInputStyles=false', async () => {
    render(<CodeMirrorEditor value="test" onChange={jest.fn()} useInputStyles={false} />);
    expect(await screen.findByRole('textbox')).toBeInTheDocument();
  });

  it('onBlur called when editor loses focus', async () => {
    const onBlur = jest.fn();
    const user = userEvent.setup();
    render(
      <>
        <CodeMirrorEditor value="blur test" onChange={jest.fn()} onBlur={onBlur} />
        <button>outside</button>
      </>
    );
    await user.click(await screen.findByRole('textbox'));
    await user.click(screen.getByRole('button', { name: 'outside' }));
    await waitFor(() => expect(onBlur).toHaveBeenCalledWith('blur test'));
  });

  it('updates highlights when highlightConfig changes', async () => {
    function Wrapper({ pattern }: { pattern: RegExp }) {
      const [config, setConfig] = React.useState<SyntaxHighlightConfig>({ pattern, className: 'highlight' });
      useEffect(() => {
        setConfig({ pattern, className: 'highlight' });
      }, [pattern]);
      return <CodeMirrorEditor value="${var}" onChange={jest.fn()} highlightConfig={config} />;
    }

    const { rerender } = render(<Wrapper pattern={/\$\{[^}]+}/g} />);
    expect(await screen.findByRole('textbox')).toBeInTheDocument();
    rerender(<Wrapper pattern={/\d+/g} />);
    expect(await screen.findByRole('textbox')).toBeInTheDocument();
  });
});
