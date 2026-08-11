import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CoreApp, type InterpolateFunction, toDataFrame } from '@grafana/data';
import { PanelContextProvider, type PanelContext } from '@grafana/ui';

import { CodeLanguage, RenderMode, TextMode } from '../panelcfg.gen';

import { type Props, TextNGPanel } from './TextNGPanel';
import { createData, createProps, renderPanel } from './test-utils';

// Stub the lazy CodeMirror bundle used by the inline editor and the read-only code view.
jest.mock('@grafana/ui/unstable', () => ({
  __esModule: true,
  CodeMirrorEditor: ({
    value,
    basicSetup,
    'aria-label': ariaLabel,
  }: {
    value: string;
    basicSetup?: { lineNumbers?: boolean };
    'aria-label'?: string;
  }) => (
    <textarea
      aria-label={ariaLabel}
      value={value}
      data-line-numbers={String(Boolean(basicSetup?.lineNumbers))}
      readOnly
    />
  ),
}));

const replaceVariablesMock = jest.fn();
const defaultProps = createProps(replaceVariablesMock);

const setup = (props: Props = defaultProps, app?: CoreApp) => {
  renderPanel(props, app);
};

describe('TextNGPanel', () => {
  beforeEach(() => {
    replaceVariablesMock.mockReset();
  });

  it('renders an empty content container when there is no content', () => {
    replaceVariablesMock.mockReturnValueOnce('');

    setup();

    expect(screen.getByTestId('TextNGPanel-converted-content').innerHTML.trim()).toBe('');
  });

  it('renders empty content when interpolating variables results in an empty string', () => {
    const contentTest = '${__all_variables}';
    replaceVariablesMock.mockReturnValueOnce('');
    const props = Object.assign({}, defaultProps, {
      options: { content: contentTest, mode: TextMode.HTML },
    });

    setup(props);

    expect(screen.getByTestId('TextNGPanel-converted-content').innerHTML.trim()).toBe('');
  });

  // Markdown renders these to '', which DangerouslySetHtmlContent throws on.
  it.each(['\n', '\n\n', '   \n  ', '<!-- just a comment -->'])(
    'renders empty content for markdown that renders to nothing: %j',
    (content) => {
      replaceVariablesMock.mockReturnValueOnce(content);
      const props = Object.assign({}, defaultProps, {
        options: { content, mode: TextMode.Markdown },
      });

      setup(props);

      expect(screen.getByTestId('TextNGPanel-converted-content').innerHTML.trim()).toBe('');
    }
  );

  it('sanitizes content in html mode', () => {
    const contentTest = '<form><p>Form tags are sanitized.</p></form>\n<script>Script tags are sanitized.</script>';
    replaceVariablesMock.mockReturnValueOnce(contentTest);
    const props = Object.assign({}, defaultProps, {
      options: { content: contentTest, mode: TextMode.HTML },
    });

    setup(props);

    expect(screen.getByTestId('TextNGPanel-converted-content').innerHTML).toEqual(
      '&lt;form&gt;<p>Form tags are sanitized.</p>&lt;/form&gt;\n&lt;script&gt;Script tags are sanitized.&lt;/script&gt;'
    );
  });

  it('sanitizes content in markdown mode', () => {
    const contentTest = '<form><p>Form tags are sanitized.</p></form>\n<script>Script tags are sanitized.</script>';
    replaceVariablesMock.mockReturnValueOnce(contentTest);

    const props = Object.assign({}, defaultProps, {
      options: { content: contentTest, mode: TextMode.Markdown },
    });

    setup(props);

    expect(screen.getByTestId('TextNGPanel-converted-content').innerHTML).toEqual(
      '&lt;form&gt;<p>Form tags are sanitized.</p>&lt;/form&gt;\n&lt;script&gt;Script tags are sanitized.&lt;/script&gt;'
    );
  });

  it('converts content to markdown when in markdown mode', async () => {
    const contentTest = 'We begin by a simple sentence.\n```code block```';
    replaceVariablesMock.mockReturnValueOnce(contentTest);

    const props = Object.assign({}, defaultProps, {
      options: { content: contentTest, mode: TextMode.Markdown },
    });

    setup(props);

    const rendered = await screen.findByTestId('TextNGPanel-converted-content');
    expect(rendered.innerHTML).toEqual('<p>We begin by a simple sentence.\n<code>code block</code></p>\n');
  });

  it('interpolates variables before content is converted to markdown', async () => {
    const contentTest = '${myVariable}';
    replaceVariablesMock.mockImplementationOnce((str) => {
      return str.replace('${myVariable}', '_hello_');
    });

    const props = Object.assign({}, defaultProps, {
      options: { content: contentTest, mode: TextMode.Markdown },
    });

    setup(props);

    const rendered = await screen.findByTestId('TextNGPanel-converted-content');
    expect(rendered.innerHTML).toEqual('<p><em>hello</em></p>\n');
  });

  it('interpolates variables correctly so they can be used in markdown urls', async () => {
    const contentTest = '[Example: ${__url_time_range}](https://example.com/?${__url_time_range})';
    replaceVariablesMock.mockImplementationOnce((str) => {
      return str.replace(/\${__url_time_range}/g, 'from=now-6h&to=now');
    });

    const props = Object.assign({}, defaultProps, {
      options: { content: contentTest, mode: TextMode.Markdown },
    });

    setup(props);

    const rendered = await screen.findByTestId('TextNGPanel-converted-content');
    expect(rendered.innerHTML).toEqual(
      '<p><a href="https://example.com/?from=now-6h&amp;to=now">Example: from=now-6h&amp;to=now</a></p>\n'
    );
  });

  it('passes raw content through unmodified in html mode', () => {
    const contentTest = 'We begin by a simple sentence.\n```This is a code block\n```';
    replaceVariablesMock.mockReturnValueOnce(contentTest);
    const props = Object.assign({}, defaultProps, {
      options: { content: contentTest, mode: TextMode.HTML },
    });

    setup(props);

    expect(screen.getByTestId('TextNGPanel-converted-content').innerHTML).toEqual(
      'We begin by a simple sentence.\n```This is a code block\n```'
    );
  });

  it('renders code mode as an unrendered, syntax-highlighted block', async () => {
    const contentTest = '{\n  "a": 1\n}';
    replaceVariablesMock.mockReturnValueOnce(contentTest);
    const props = Object.assign({}, defaultProps, {
      options: { content: contentTest, mode: TextMode.Code },
    });

    setup(props);

    expect(screen.getByTestId('TextNGPanel-code')).toBeInTheDocument();
    expect(await screen.findByRole('textbox')).toHaveValue('{\n  "a": 1\n}');
    expect(screen.queryByTestId('TextNGPanel-converted-content')).not.toBeInTheDocument();
  });

  it('passes showLineNumbers to the code view', async () => {
    const contentTest = '{\n  "a": 1\n}';
    replaceVariablesMock.mockReturnValueOnce(contentTest);
    const props = Object.assign({}, defaultProps, {
      options: {
        content: contentTest,
        mode: TextMode.Code,
        code: { language: CodeLanguage.Json, showLineNumbers: true },
      },
    });

    setup(props);

    expect(await screen.findByRole('textbox')).toHaveAttribute('data-line-numbers', 'true');
  });

  describe('edit mode', () => {
    it('renders the inline editor in the panel area when the panel is being edited', async () => {
      const props = Object.assign({}, defaultProps, {
        options: { content: '# Hello', mode: TextMode.Markdown },
      });

      setup(props, CoreApp.PanelEditor);

      expect(await screen.findByTestId('TextNGEditor')).toBeInTheDocument();
      expect(screen.queryByTestId('TextNGPanel-converted-content')).not.toBeInTheDocument();
    });

    it('merges a language change made in the editor into the existing code options', async () => {
      replaceVariablesMock.mockImplementation((str: string) => str);
      const onOptionsChange = jest.fn();
      const props = Object.assign({}, defaultProps, {
        options: {
          content: 'SELECT 1',
          mode: TextMode.Code,
          code: { language: CodeLanguage.Plaintext, showLineNumbers: true, showMiniMap: false },
        },
        onOptionsChange,
      });

      setup(props, CoreApp.PanelEditor);

      await userEvent.click(await screen.findByRole('button', { name: /^Text mode/ }));
      await userEvent.hover(screen.getByRole('menuitem', { name: 'Code' }));
      await userEvent.click(await screen.findByRole('menuitemradio', { name: 'SQL' }));

      expect(onOptionsChange).toHaveBeenCalledWith({
        content: 'SELECT 1',
        mode: TextMode.Code,
        code: { language: CodeLanguage.Sql, showLineNumbers: true, showMiniMap: false },
      });
    });

    describe('line numbers toggled in the editor footer', () => {
      const toggleLineNumbers = async (options: Props['options']) => {
        replaceVariablesMock.mockImplementation((str: string) => str);
        const onOptionsChange = jest.fn();

        setup(Object.assign({}, defaultProps, { options, onOptionsChange }), CoreApp.PanelEditor);
        await userEvent.click(await screen.findByRole('switch', { name: 'Line numbers' }));

        return onOptionsChange;
      };

      it('keeps the existing code options', async () => {
        const onOptionsChange = await toggleLineNumbers({
          content: 'SELECT 1',
          mode: TextMode.Code,
          code: { language: CodeLanguage.Sql, showLineNumbers: false, showMiniMap: false },
        });

        expect(onOptionsChange).toHaveBeenCalledWith({
          content: 'SELECT 1',
          mode: TextMode.Code,
          code: { language: CodeLanguage.Sql, showLineNumbers: true, showMiniMap: false },
        });
      });

      it('fills in the defaults when no code options are set', async () => {
        const onOptionsChange = await toggleLineNumbers({ content: 'SELECT 1', mode: TextMode.Code });

        expect(onOptionsChange).toHaveBeenCalledWith({
          content: 'SELECT 1',
          mode: TextMode.Code,
          code: { language: CodeLanguage.Plaintext, showLineNumbers: true, showMiniMap: false },
        });
      });
    });

    it('does not render the inline editor in view mode', () => {
      const props = Object.assign({}, defaultProps, {
        options: { content: '# Hello', mode: TextMode.Markdown },
      });

      setup(props, CoreApp.Dashboard);

      expect(screen.queryByTestId('TextNGEditor')).not.toBeInTheDocument();
      expect(screen.getByTestId('TextNGPanel-converted-content')).toBeInTheDocument();
    });

    it('shows the edited content immediately after leaving edit mode', async () => {
      replaceVariablesMock.mockImplementation((str: string) => str);
      const props = Object.assign({}, defaultProps, {
        options: { content: '# Hello', mode: TextMode.Markdown },
      });

      const { rerender } = render(
        <PanelContextProvider value={{ app: CoreApp.PanelEditor } as PanelContext}>
          <TextNGPanel {...props} />
        </PanelContextProvider>
      );
      expect(await screen.findByTestId('TextNGEditor')).toBeInTheDocument();

      // The debounce that applies while the editor owns rendering must not delay this.
      const edited = Object.assign({}, props, {
        options: { content: '# Edited', mode: TextMode.Markdown },
      });
      rerender(
        <PanelContextProvider value={{ app: CoreApp.Dashboard } as PanelContext}>
          <TextNGPanel {...edited} />
        </PanelContextProvider>
      );

      expect(screen.getByTestId('TextNGPanel-converted-content').innerHTML).toContain('Edited');
    });
  });

  describe('render mode', () => {
    const series = [
      toDataFrame({
        fields: [{ name: 'host', values: ['web-1', 'web-2'] }],
      }),
    ];

    // Reports the row context it was handed, so these assert the wiring rather
    // than re-testing macro resolution (covered in renderContent.test.ts).
    const reportRowContext: InterpolateFunction = (target, scopedVars) => {
      const context = scopedVars?.__dataContext?.value;
      return context ? `row-${context.rowIndex}` : target;
    };

    function setupWithData(renderMode?: RenderMode) {
      const props = createProps(reportRowContext, {
        data: createData(series),
        options: { content: 'no row context', mode: TextMode.Markdown, renderMode },
      });

      setup(props, CoreApp.Dashboard);
      return screen.getByTestId('TextNGPanel-converted-content').innerHTML;
    }

    it('renders the content once per row in every row mode', () => {
      const html = setupWithData(RenderMode.PerRow);

      expect(html).toContain('row-0');
      expect(html).toContain('row-1');
    });

    it.each([
      ['once mode', RenderMode.Once],
      ['an unset render mode', undefined],
    ])('renders once with no row context in %s', (_name, renderMode) => {
      expect(setupWithData(renderMode)).toContain('no row context');
    });
  });
});
