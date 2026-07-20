import { render, screen } from '@testing-library/react';

import { CoreApp, type PanelProps } from '@grafana/data';
import { PanelContextProvider, type PanelContext } from '@grafana/ui';

import { TextNGPanel } from './TextNGPanel';
import { defaultOptions, type Options, TextMode } from './panelcfg.gen';

// Stub the heavy lazy CodeMirror bundle used by the inline editor.
jest.mock('@grafana/ui/unstable', () => ({
  __esModule: true,
  CodeMirrorEditor: ({ value, 'aria-label': ariaLabel }: { value: string; 'aria-label'?: string }) => (
    <textarea aria-label={ariaLabel} value={value} readOnly />
  ),
}));

const defaultProps = {
  options: defaultOptions as Options,
  onOptionsChange: jest.fn(),
} as unknown as PanelProps<Options>;

const setup = (options: Partial<Options>, app?: CoreApp) => {
  const merged = { ...defaultOptions, ...options } as Options;
  const ui = <TextNGPanel {...defaultProps} options={merged} />;
  render(app ? <PanelContextProvider value={{ app } as PanelContext}>{ui}</PanelContextProvider> : ui);
};

describe('TextNGPanel', () => {
  describe('view mode', () => {
    it('renders without content', () => {
      expect(() => setup({ content: '', mode: TextMode.Markdown })).not.toThrow();
    });

    it('sanitizes content in html mode', () => {
      const content = '<form><p>Form tags are sanitized.</p></form>\n<script>Script tags are sanitized.</script>';

      setup({ content, mode: TextMode.HTML });

      expect(screen.getByTestId('TextNGPanel-converted-content').innerHTML).toEqual(
        '&lt;form&gt;<p>Form tags are sanitized.</p>&lt;/form&gt;\n&lt;script&gt;Script tags are sanitized.&lt;/script&gt;'
      );
    });

    it('converts content to markdown when in markdown mode', () => {
      const content = 'We begin by a simple sentence.\n```code block```';

      setup({ content, mode: TextMode.Markdown });

      expect(screen.getByTestId('TextNGPanel-converted-content').innerHTML).toEqual(
        '<p>We begin by a simple sentence.\n<code>code block</code></p>\n'
      );
    });

    it('renders code mode as a plain, unrendered block', () => {
      const content = '{\n  "a": 1\n}';

      setup({ content, mode: TextMode.Code });

      expect(screen.getByTestId('TextNGPanel-code')).toHaveTextContent('{ "a": 1 }');
    });
  });

  describe('edit mode', () => {
    it('renders the inline editor when the panel is being edited', () => {
      setup({ content: '# Hello', mode: TextMode.Markdown }, CoreApp.PanelEditor);

      expect(screen.getByTestId('TextNGEditor')).toBeInTheDocument();
      expect(screen.queryByTestId('TextNGPanel-converted-content')).not.toBeInTheDocument();
    });

    it('does not render the inline editor in view mode', () => {
      setup({ content: '# Hello', mode: TextMode.Markdown }, CoreApp.Dashboard);

      expect(screen.queryByTestId('TextNGEditor')).not.toBeInTheDocument();
      expect(screen.getByTestId('TextNGPanel-converted-content')).toBeInTheDocument();
    });
  });
});
