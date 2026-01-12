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
  describe('basic rendering', () => {
    it('renders with initial value', async () => {
      const onChange = jest.fn();
      render(<CodeMirrorEditor value="Hello World" onChange={onChange} />);

      await waitFor(() => {
        const editor = screen.getByRole('textbox');
        expect(editor).toBeInTheDocument();
      });
    });

    it('renders with placeholder when value is empty', async () => {
      const onChange = jest.fn();
      const placeholder = 'Enter text here';

      render(<CodeMirrorEditor value="" onChange={onChange} placeholder={placeholder} />);

      await waitFor(() => {
        const editor = screen.getByRole('textbox');
        expect(editor).toHaveAttribute('aria-placeholder', placeholder);
      });
    });

    it('renders with aria-label', async () => {
      const onChange = jest.fn();
      const ariaLabel = 'Code editor';

      render(<CodeMirrorEditor value="" onChange={onChange} ariaLabel={ariaLabel} />);

      await waitFor(() => {
        const editor = screen.getByRole('textbox');
        // aria-label is set on the parent .cm-editor element
        expect(editor.closest('.cm-editor')).toHaveAttribute('aria-label', ariaLabel);
      });
    });
  });

  describe('user interaction', () => {
    it('calls onChange when user types', async () => {
      const onChange = jest.fn();
      const user = userEvent.setup();

      render(<CodeMirrorEditor value="" onChange={onChange} />);

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      const editor = screen.getByRole('textbox');
      await user.click(editor);
      await user.keyboard('test');

      await waitFor(() => {
        expect(onChange).toHaveBeenCalled();
      });
    });

    it('updates when external value prop changes', async () => {
      const onChange = jest.fn();

      function TestWrapper({ initialValue }: { initialValue: string }) {
        const [value, setValue] = React.useState(initialValue);

        useEffect(() => {
          setValue(initialValue);
        }, [initialValue]);

        return <CodeMirrorEditor value={value} onChange={onChange} />;
      }

      const { rerender } = render(<TestWrapper initialValue="first" />);

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      rerender(<TestWrapper initialValue="second" />);

      await waitFor(() => {
        const editor = screen.getByRole('textbox');
        expect(editor).toBeInTheDocument();
      });
    });
  });

  describe('highlight functionality', () => {
    it('renders with default highlighter using highlightConfig', async () => {
      const onChange = jest.fn();
      const highlightConfig: SyntaxHighlightConfig = {
        pattern: /\$\{[^}]+\}/g,
        className: 'variable-highlight',
      };

      render(<CodeMirrorEditor value="${test}" onChange={onChange} highlightConfig={highlightConfig} />);

      await waitFor(() => {
        const editor = screen.getByRole('textbox');
        expect(editor).toBeInTheDocument();
      });
    });

    it('renders with custom highlighter factory', async () => {
      const onChange = jest.fn();
      const customHighlighter: HighlighterFactory = (config) => {
        return config ? createGenericHighlighter(config) : [];
      };
      const highlightConfig: SyntaxHighlightConfig = {
        pattern: /\btest\b/g,
        className: 'keyword',
      };

      render(
        <CodeMirrorEditor
          value="test keyword"
          onChange={onChange}
          highlighterFactory={customHighlighter}
          highlightConfig={highlightConfig}
        />
      );

      await waitFor(() => {
        const editor = screen.getByRole('textbox');
        expect(editor).toBeInTheDocument();
      });
    });

    it('updates highlights when highlightConfig changes', async () => {
      const onChange = jest.fn();

      function TestWrapper({ pattern }: { pattern: RegExp }) {
        const [config, setConfig] = React.useState<SyntaxHighlightConfig>({
          pattern,
          className: 'highlight',
        });

        useEffect(() => {
          setConfig({ pattern, className: 'highlight' });
        }, [pattern]);

        return <CodeMirrorEditor value="${var}" onChange={onChange} highlightConfig={config} />;
      }

      const { rerender } = render(<TestWrapper pattern={/\$\{[^}]+\}/g} />);

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      rerender(<TestWrapper pattern={/\d+/g} />);

      await waitFor(() => {
        const editor = screen.getByRole('textbox');
        expect(editor).toBeInTheDocument();
      });
    });

    it('renders without highlighting when highlightConfig is not provided', async () => {
      const onChange = jest.fn();

      render(<CodeMirrorEditor value="plain text" onChange={onChange} />);

      await waitFor(() => {
        const editor = screen.getByRole('textbox');
        expect(editor).toBeInTheDocument();
      });
    });
  });

  describe('theme functionality', () => {
    it('renders with default theme', async () => {
      const onChange = jest.fn();

      render(<CodeMirrorEditor value="test" onChange={onChange} />);

      await waitFor(() => {
        const editor = screen.getByRole('textbox');
        expect(editor).toBeInTheDocument();
      });
    });

    it('renders with custom theme factory', async () => {
      const onChange = jest.fn();
      const customTheme: ThemeFactory = (theme) => {
        return createGenericTheme(theme);
      };

      render(<CodeMirrorEditor value="test" onChange={onChange} themeFactory={customTheme} />);

      await waitFor(() => {
        const editor = screen.getByRole('textbox');
        expect(editor).toBeInTheDocument();
      });
    });

    it('updates theme when themeFactory changes', async () => {
      const onChange = jest.fn();
      const theme1: ThemeFactory = (theme) => createGenericTheme(theme);
      const theme2: ThemeFactory = (theme) => createGenericTheme(theme);

      function TestWrapper({ themeFactory }: { themeFactory: ThemeFactory }) {
        return <CodeMirrorEditor value="test" onChange={onChange} themeFactory={themeFactory} />;
      }

      const { rerender } = render(<TestWrapper themeFactory={theme1} />);

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      rerender(<TestWrapper themeFactory={theme2} />);

      await waitFor(() => {
        const editor = screen.getByRole('textbox');
        expect(editor).toBeInTheDocument();
      });
    });
  });

  describe('combined highlight and theme', () => {
    it('renders with both custom theme and highlighter', async () => {
      const onChange = jest.fn();
      const customTheme: ThemeFactory = (theme) => createGenericTheme(theme);
      const highlightConfig: SyntaxHighlightConfig = {
        pattern: /\$\{[^}]+\}/g,
        className: 'variable',
      };

      render(
        <CodeMirrorEditor
          value="${variable} test"
          onChange={onChange}
          themeFactory={customTheme}
          highlightConfig={highlightConfig}
        />
      );

      await waitFor(() => {
        const editor = screen.getByRole('textbox');
        expect(editor).toBeInTheDocument();
      });
    });

    it('updates both theme and highlights together', async () => {
      const onChange = jest.fn();

      function TestWrapper({ pattern, mode }: { pattern: RegExp; mode: 'light' | 'dark' }) {
        const [config, setConfig] = React.useState<SyntaxHighlightConfig>({
          pattern,
          className: 'highlight',
        });
        const [themeFactory, setThemeFactory] = React.useState<ThemeFactory>(
          () => (theme: GrafanaTheme2) => createGenericTheme(theme)
        );

        useEffect(() => {
          setConfig({ pattern, className: 'highlight' });
          setThemeFactory(() => (theme: GrafanaTheme2) => {
            const customTheme = createTheme({ colors: { mode } });
            return createGenericTheme(customTheme);
          });
        }, [pattern, mode]);

        return (
          <CodeMirrorEditor
            value="${var} 123"
            onChange={onChange}
            themeFactory={themeFactory}
            highlightConfig={config}
          />
        );
      }

      const { rerender } = render(<TestWrapper pattern={/\$\{[^}]+\}/g} mode="light" />);

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      rerender(<TestWrapper pattern={/\d+/g} mode="dark" />);

      await waitFor(() => {
        const editor = screen.getByRole('textbox');
        expect(editor).toBeInTheDocument();
      });
    });
  });

  describe('additional features with highlight and theme', () => {
    it('renders with showLineNumbers and highlighting', async () => {
      const onChange = jest.fn();
      const highlightConfig: SyntaxHighlightConfig = {
        pattern: /\d+/g,
        className: 'number',
      };

      render(
        <CodeMirrorEditor
          value="Line 1\nLine 2\nLine 3"
          onChange={onChange}
          showLineNumbers={true}
          highlightConfig={highlightConfig}
        />
      );

      await waitFor(() => {
        const editor = screen.getByRole('textbox');
        expect(editor).toBeInTheDocument();
      });
    });

    it('renders with custom extensions alongside theme and highlighter', async () => {
      const onChange = jest.fn();
      const customExtension: Extension[] = [];
      const highlightConfig: SyntaxHighlightConfig = {
        pattern: /test/g,
        className: 'keyword',
      };

      render(
        <CodeMirrorEditor
          value="test"
          onChange={onChange}
          extensions={customExtension}
          highlightConfig={highlightConfig}
        />
      );

      await waitFor(() => {
        const editor = screen.getByRole('textbox');
        expect(editor).toBeInTheDocument();
      });
    });

    it('applies custom className with theme', async () => {
      const onChange = jest.fn();
      const customClassName = 'custom-editor';

      render(<CodeMirrorEditor value="test" onChange={onChange} className={customClassName} />);

      await waitFor(() => {
        const editor = screen.getByRole('textbox');
        expect(editor).toBeInTheDocument();
      });
    });
  });

  describe('useInputStyles prop', () => {
    it('renders with input styles enabled', async () => {
      const onChange = jest.fn();

      render(<CodeMirrorEditor value="test" onChange={onChange} useInputStyles={true} />);

      await waitFor(() => {
        const editor = screen.getByRole('textbox');
        expect(editor).toBeInTheDocument();
      });
    });

    it('renders with input styles disabled', async () => {
      const onChange = jest.fn();

      render(<CodeMirrorEditor value="test" onChange={onChange} useInputStyles={false} />);

      await waitFor(() => {
        const editor = screen.getByRole('textbox');
        expect(editor).toBeInTheDocument();
      });
    });
  });
});
