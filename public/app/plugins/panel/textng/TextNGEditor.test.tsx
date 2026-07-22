import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { TextNGEditor } from './TextNGEditor';
import { TextMode } from './panelcfg.gen';

// The real CodeMirrorEditor pulls in a heavy, lazily-loaded CodeMirror bundle;
// stub it with a plain textarea so these tests stay fast and deterministic.
jest.mock('@grafana/ui/unstable', () => ({
  __esModule: true,
  CodeMirrorEditor: ({
    value,
    onChange,
    basicSetup,
    'aria-label': ariaLabel,
  }: {
    value: string;
    onChange: (value: string) => void;
    basicSetup?: { lineNumbers?: boolean };
    'aria-label'?: string;
  }) => (
    <textarea
      aria-label={ariaLabel}
      value={value}
      data-line-numbers={String(Boolean(basicSetup?.lineNumbers))}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

function ControlledEditor({
  initialValue,
  mode,
  wordWrap = true,
  showLineNumbers = false,
  onChange,
}: {
  initialValue: string;
  mode: TextMode;
  wordWrap?: boolean;
  showLineNumbers?: boolean;
  onChange: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <TextNGEditor
      content={value}
      mode={mode}
      wordWrap={wordWrap}
      showLineNumbers={showLineNumbers}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

const setup = (value: string, mode: TextMode, onChange = jest.fn(), wordWrap = true, showLineNumbers = false) => {
  render(
    <ControlledEditor
      initialValue={value}
      mode={mode}
      wordWrap={wordWrap}
      showLineNumbers={showLineNumbers}
      onChange={onChange}
    />
  );
  return { onChange };
};

const enterWriteMode = () => userEvent.click(screen.getByRole('radio', { name: 'Write' }));

describe('TextNGEditor', () => {
  describe('default (view-first) state', () => {
    it('lands on the rendered preview, not the editor', () => {
      setup('# Hello', TextMode.Markdown);

      expect(screen.getByTestId('TextNGEditor-preview').innerHTML).toContain('<h1');
      expect(screen.getByRole('radio', { name: 'Preview' })).toBeChecked();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('opens straight into the editor when content is empty', () => {
      setup('', TextMode.Markdown);

      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Write' })).toBeChecked();
    });

    it('reveals the editor after selecting Write', async () => {
      setup('# Hello', TextMode.Markdown);

      await enterWriteMode();
      expect(screen.getByRole('textbox')).toHaveValue('# Hello');
      expect(screen.queryByTestId('TextNGEditor-preview')).not.toBeInTheDocument();
    });
  });

  describe('editing', () => {
    it('shows only the editor in Write view', async () => {
      setup('# Hello', TextMode.Markdown);
      await enterWriteMode();

      expect(screen.getByRole('textbox')).toHaveValue('# Hello');
      expect(screen.queryByTestId('TextNGEditor-preview')).not.toBeInTheDocument();
    });

    it('shows only the rendered preview in Preview view', () => {
      setup('# Hello', TextMode.Markdown);

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.getByTestId('TextNGEditor-preview').innerHTML).toContain('<h1');
    });

    it('shows editor and preview side by side in Split view', async () => {
      setup('# Hello', TextMode.Markdown);

      await userEvent.click(screen.getByRole('radio', { name: 'Split' }));

      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByTestId('TextNGEditor-preview')).toBeInTheDocument();
    });

    it('sanitizes script tags in the HTML mode preview', () => {
      setup('<script>alert(1)</script><p>safe</p>', TextMode.HTML);

      const preview = screen.getByTestId('TextNGEditor-preview');
      expect(preview.innerHTML).not.toContain('<script>');
      expect(preview.innerHTML).toContain('safe');
    });

    it('renders code mode preview as raw, unrendered text', () => {
      setup('# Not a heading in code mode', TextMode.Code);

      const preview = screen.getByTestId('TextNGEditor-preview');
      expect(preview).toHaveTextContent('# Not a heading in code mode');
      expect(preview.innerHTML).not.toContain('<h1');
    });

    it('shows a formatting toolbar in markdown write mode', async () => {
      setup('hello', TextMode.Markdown);
      await enterWriteMode();

      expect(screen.getByRole('button', { name: 'Insert variable' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Insert Mermaid diagram' })).toBeInTheDocument();
    });

    it('reflects word-wrap state in the status bar', () => {
      setup('hello', TextMode.Markdown, jest.fn(), false);

      expect(screen.getByText('Word wrap off')).toBeInTheDocument();
    });

    it('forwards editor changes via onChange', async () => {
      const { onChange } = setup('initial', TextMode.Markdown);
      await enterWriteMode();

      const editor = screen.getByRole('textbox');
      await userEvent.clear(editor);
      await userEvent.type(editor, 'updated');

      expect(onChange).toHaveBeenLastCalledWith('updated');
    });
  });

  describe('line numbers', () => {
    it('never shows line numbers in Markdown mode', async () => {
      setup('# Hello', TextMode.Markdown, jest.fn(), true, true);
      await enterWriteMode();

      expect(screen.getByRole('textbox')).toHaveAttribute('data-line-numbers', 'false');
    });

    it('never shows line numbers in HTML mode', async () => {
      setup('<p>Hello</p>', TextMode.HTML, jest.fn(), true, true);
      await enterWriteMode();

      expect(screen.getByRole('textbox')).toHaveAttribute('data-line-numbers', 'false');
    });

    it('shows line numbers in Code mode when showLineNumbers is enabled', async () => {
      setup('const a = 1;', TextMode.Code, jest.fn(), true, true);
      await enterWriteMode();

      expect(screen.getByRole('textbox')).toHaveAttribute('data-line-numbers', 'true');
    });

    it('hides line numbers in Code mode when showLineNumbers is disabled', async () => {
      setup('const a = 1;', TextMode.Code, jest.fn(), true, false);
      await enterWriteMode();

      expect(screen.getByRole('textbox')).toHaveAttribute('data-line-numbers', 'false');
    });
  });
});
