import { render, screen } from '@testing-library/react';

import { CoreApp, dateTime, LoadingState, EventBusSrv } from '@grafana/data';
import { PanelContextProvider, type PanelContext } from '@grafana/ui';

import { CodeLanguage, TextMode } from '../../schemas/textng/panelcfg.gen';

import { type Props, TextNGPanel } from './TextNGPanel';

// Stub the heavy lazy CodeMirror bundle used by the inline editor and the
// read-only code view.
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
const defaultProps: Props = {
  id: 1,
  data: {
    state: LoadingState.Done,
    series: [
      {
        fields: [],
        length: 0,
      },
    ],
    timeRange: {
      from: dateTime('2022-01-01T15:55:00Z'),
      to: dateTime('2022-07-12T15:55:00Z'),
      raw: {
        from: 'now-15m',
        to: 'now',
      },
    },
  },
  timeRange: {
    from: dateTime('2022-07-11T15:55:00Z'),
    to: dateTime('2022-07-12T15:55:00Z'),
    raw: {
      from: 'now-15m',
      to: 'now',
    },
  },
  timeZone: 'utc',
  transparent: false,
  width: 120,
  height: 120,
  fieldConfig: {
    defaults: {},
    overrides: [],
  },
  renderCounter: 1,
  title: 'Test Text Panel',
  eventBus: new EventBusSrv(),
  options: { content: '', mode: TextMode.Markdown },
  onOptionsChange: jest.fn(),
  onFieldConfigChange: jest.fn(),
  replaceVariables: replaceVariablesMock,
  onChangeTimeRange: jest.fn(),
};

const setup = (props: Props = defaultProps, app?: CoreApp) => {
  const ui = <TextNGPanel {...props} />;
  render(app ? <PanelContextProvider value={{ app } as PanelContext}>{ui}</PanelContextProvider> : ui);
};

describe('TextNGPanel', () => {
  it('should render panel without content', () => {
    expect(() => setup()).not.toThrow();
  });

  it('should not throw an error when interpolating variables results in empty content', () => {
    const contentTest = '${__all_variables}';
    const props = Object.assign({}, defaultProps, {
      options: { content: contentTest, mode: TextMode.HTML },
    });

    expect(() => setup(props)).not.toThrow();
  });

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

    const waited = await screen.getByTestId('TextNGPanel-converted-content');
    expect(waited.innerHTML).toEqual('<p>We begin by a simple sentence.\n<code>code block</code></p>\n');
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

    const waited = await screen.getByTestId('TextNGPanel-converted-content');
    expect(waited.innerHTML).toEqual('<p><em>hello</em></p>\n');
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

    const waited = await screen.getByTestId('TextNGPanel-converted-content');
    expect(waited.innerHTML).toEqual(
      '<p><a href="https://example.com/?from=now-6h&amp;to=now">Example: from=now-6h&amp;to=now</a></p>\n'
    );
  });

  it('converts content to html when in html mode', () => {
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
    // The lazily-loaded read-only code view gets the raw, uninterpreted content.
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

    it('does not render the inline editor in view mode', () => {
      const props = Object.assign({}, defaultProps, {
        options: { content: '# Hello', mode: TextMode.Markdown },
      });

      setup(props, CoreApp.Dashboard);

      expect(screen.queryByTestId('TextNGEditor')).not.toBeInTheDocument();
      expect(screen.getByTestId('TextNGPanel-converted-content')).toBeInTheDocument();
    });
  });
});
