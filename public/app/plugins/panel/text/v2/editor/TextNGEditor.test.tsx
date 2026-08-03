import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import config from 'app/core/config';

import { CodeLanguage, TextMode } from '../../panelcfg.gen';

import { PREVIEW_TEST_ID, TextNGEditor } from './TextNGEditor';
import { FORMAT_TOOLBAR_TEST_ID } from './TextNGFormatToolbar';

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
  showLineNumbers = false,
  codeLanguage,
  replaceVariables = (value: string) => value,
  onChange,
}: {
  initialValue: string;
  mode: TextMode;
  showLineNumbers?: boolean;
  codeLanguage?: CodeLanguage;
  replaceVariables?: (value: string) => string;
  onChange: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <TextNGEditor
      content={value}
      mode={mode}
      showLineNumbers={showLineNumbers}
      codeLanguage={codeLanguage}
      replaceVariables={replaceVariables}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

const setup = (
  value: string,
  mode: TextMode,
  onChange = jest.fn(),
  showLineNumbers = false,
  codeLanguage?: CodeLanguage,
  replaceVariables: (value: string) => string = (v) => v
) => {
  render(
    <ControlledEditor
      initialValue={value}
      mode={mode}
      showLineNumbers={showLineNumbers}
      codeLanguage={codeLanguage}
      replaceVariables={replaceVariables}
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

      expect(screen.getByTestId(PREVIEW_TEST_ID).innerHTML).toContain('<h1');
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
      expect(screen.queryByTestId(PREVIEW_TEST_ID)).not.toBeInTheDocument();
    });
  });

  describe('views', () => {
    it('shows only the rendered preview in Preview view', () => {
      setup('# Hello', TextMode.Markdown);

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.getByTestId(PREVIEW_TEST_ID).innerHTML).toContain('<h1');
    });

    it('shows editor and preview side by side in Split view', async () => {
      setup('# Hello', TextMode.Markdown);

      await userEvent.click(screen.getByRole('radio', { name: 'Split' }));

      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByTestId(PREVIEW_TEST_ID)).toBeInTheDocument();
    });

    it('sanitizes script tags in the HTML mode preview', () => {
      setup('<script>alert(1)</script><p>safe</p>', TextMode.HTML);

      const preview = screen.getByTestId(PREVIEW_TEST_ID);
      expect(preview.innerHTML).not.toContain('<script>');
      expect(preview.innerHTML).toContain('safe');
    });

    it('skips sanitization in the preview when disableSanitizeHtml is set, matching the panel', () => {
      const original = config.disableSanitizeHtml;
      config.disableSanitizeHtml = true;
      try {
        setup('<form><p>kept</p></form>', TextMode.HTML);

        const preview = screen.getByTestId(PREVIEW_TEST_ID);
        expect(preview.innerHTML).toContain('<form>');
      } finally {
        config.disableSanitizeHtml = original;
      }
    });

    it('renders code mode preview as a raw, unrendered code view', () => {
      setup('# Not a heading in code mode', TextMode.Code);

      const preview = screen.getByTestId(PREVIEW_TEST_ID);
      // The preview reuses the read-only code view, so the content stays raw.
      expect(within(preview).getByRole('textbox')).toHaveValue('# Not a heading in code mode');
      expect(preview.innerHTML).not.toContain('<h1');
    });

    it('passes language and line numbers to the code mode preview', () => {
      setup('{\n  "a": 1\n}', TextMode.Code, jest.fn(), true, CodeLanguage.Json);

      const preview = screen.getByTestId(PREVIEW_TEST_ID);
      expect(within(preview).getByRole('textbox')).toHaveAttribute('data-line-numbers', 'true');
    });

    it('interpolates variables in the preview but keeps the raw template in the editor', async () => {
      const replaceVariables = (value: string) => value.replace('$datacenter', 'A, B, C');
      setup('# Data center = $datacenter', TextMode.Markdown, jest.fn(), false, undefined, replaceVariables);

      expect(screen.getByTestId(PREVIEW_TEST_ID)).toHaveTextContent('Data center = A, B, C');

      await userEvent.click(screen.getByRole('radio', { name: 'Write' }));
      expect(screen.getByRole('textbox')).toHaveValue('# Data center = $datacenter');
    });

    it('forwards editor changes via a debounced onChange', async () => {
      const { onChange } = setup('initial', TextMode.Markdown);
      await enterWriteMode();

      const editor = screen.getByRole('textbox');
      await userEvent.clear(editor);
      await userEvent.type(editor, 'updated');

      // The commit is debounced so the dashboard is not re-rendered per keystroke.
      await waitFor(() => expect(onChange).toHaveBeenLastCalledWith('updated'));
    });

    it('commits a pending draft when the editor loses focus', async () => {
      const { onChange } = setup('initial', TextMode.Markdown);
      await enterWriteMode();

      const editor = screen.getByRole('textbox');
      await userEvent.clear(editor);
      await userEvent.type(editor, 'updated');

      // Moving focus out (e.g. clicking Save/Apply) must persist the draft
      // synchronously instead of waiting out the commit debounce.
      await userEvent.tab();

      expect(onChange).toHaveBeenLastCalledWith('updated');
    });

    it('commits the latest draft when the last change and the blur happen in the same event turn', async () => {
      const { onChange } = setup('initial', TextMode.Markdown);
      await enterWriteMode();

      const editor = screen.getByRole('textbox');
      // One batch: the blur handler runs before React re-renders with the new draft.
      act(() => {
        fireEvent.change(editor, { target: { value: 'updated' } });
        fireEvent.blur(editor);
      });

      expect(onChange).toHaveBeenCalledWith('updated');
    });

    it('does not commit a pending draft on unmount, so Discard is not overwritten', async () => {
      const onChange = jest.fn();
      const { unmount } = render(
        <ControlledEditor initialValue="initial" mode={TextMode.Markdown} onChange={onChange} />
      );
      await enterWriteMode();

      const editor = screen.getByRole('textbox');
      await userEvent.clear(editor);
      await userEvent.type(editor, 'updated');

      unmount();

      // A flush here could overwrite a Discard.
      expect(onChange).not.toHaveBeenCalledWith('updated');
    });

    it('interpolates with the json format when code language is json, regardless of mode', () => {
      const replaceVariables = jest.fn((value: string) => value);
      setup('# Hello', TextMode.Markdown, jest.fn(), false, CodeLanguage.Json, replaceVariables);

      // Matches the panel render path, which keys the interpolation format off
      // code.language alone.
      expect(replaceVariables).toHaveBeenCalledWith('# Hello', {}, 'json');
    });
  });

  describe('content that renders to nothing', () => {
    // Deleting everything and pressing enter in Split view: markdown renders a
    // lone newline to '', which the space fallback keeps DangerouslySetHtmlContent
    // from throwing on.
    it.each(['\n', '\n\n', '   \n  ', '<!-- just a comment -->'])(
      'renders the empty space fallback in the preview for %j',
      async (content) => {
        setup('# Hello', TextMode.Markdown);
        await userEvent.click(screen.getByRole('radio', { name: 'Split' }));

        // fireEvent, because userEvent.type() does not reproduce a value that is
        // only whitespace. A throw here fails the test.
        fireEvent.change(screen.getByRole('textbox'), { target: { value: content } });

        // Debounced preview settles from the '# Hello' <h1> to the space fallback.
        await waitFor(() => expect(screen.getByTestId(PREVIEW_TEST_ID).innerHTML.trim()).toBe(''));
      }
    );
  });

  describe('preview updates', () => {
    it('re-renders the preview once typing settles', async () => {
      setup('# Hello', TextMode.Markdown);
      await userEvent.click(screen.getByRole('radio', { name: 'Split' }));

      fireEvent.change(screen.getByRole('textbox'), { target: { value: '## Updated' } });

      // Still the old preview: the update is debounced.
      expect(screen.getByTestId(PREVIEW_TEST_ID).innerHTML).toContain('<h1');
      await waitFor(() => expect(screen.getByTestId(PREVIEW_TEST_ID).innerHTML).toContain('<h2'));
    });

    it('shows the current draft immediately when switching view, without waiting for the debounce', async () => {
      setup('# Hello', TextMode.Markdown);
      await enterWriteMode();

      fireEvent.change(screen.getByRole('textbox'), { target: { value: '## Updated' } });
      await userEvent.click(screen.getByRole('radio', { name: 'Preview' }));

      expect(screen.getByTestId(PREVIEW_TEST_ID).innerHTML).toContain('<h2');
    });

    it('shows externally replaced content immediately, e.g. after a discard', async () => {
      const { rerender } = render(
        <TextNGEditor
          content="# Hello"
          mode={TextMode.Markdown}
          showLineNumbers={false}
          replaceVariables={(value: string) => value}
          onChange={jest.fn()}
        />
      );

      rerender(
        <TextNGEditor
          content="## Reverted"
          mode={TextMode.Markdown}
          showLineNumbers={false}
          replaceVariables={(value: string) => value}
          onChange={jest.fn()}
        />
      );

      expect(screen.getByTestId(PREVIEW_TEST_ID).innerHTML).toContain('<h2');
    });
  });

  describe('formatting toolbar', () => {
    it('renders alongside the editor in Write view', async () => {
      setup('hello', TextMode.Markdown);
      await enterWriteMode();

      expect(screen.getByTestId(FORMAT_TOOLBAR_TEST_ID)).toBeInTheDocument();
    });

    it('renders in Split view', async () => {
      setup('hello', TextMode.Markdown);

      await userEvent.click(screen.getByRole('radio', { name: 'Split' }));

      expect(screen.getByTestId(FORMAT_TOOLBAR_TEST_ID)).toBeInTheDocument();
    });

    it('is hidden in Preview view, where there is nothing to format', () => {
      setup('hello', TextMode.Markdown);

      expect(screen.queryByTestId(FORMAT_TOOLBAR_TEST_ID)).not.toBeInTheDocument();
    });

    it('is not rendered in Code mode', async () => {
      setup('const a = 1;', TextMode.Code, jest.fn(), false, CodeLanguage.Typescript);
      await enterWriteMode();

      expect(screen.queryByTestId(FORMAT_TOOLBAR_TEST_ID)).not.toBeInTheDocument();
    });
  });

  describe('line numbers', () => {
    it('never shows line numbers in Markdown mode', async () => {
      setup('# Hello', TextMode.Markdown, jest.fn(), true);
      await enterWriteMode();

      expect(screen.getByRole('textbox')).toHaveAttribute('data-line-numbers', 'false');
    });

    it('never shows line numbers in HTML mode', async () => {
      setup('<p>Hello</p>', TextMode.HTML, jest.fn(), true);
      await enterWriteMode();

      expect(screen.getByRole('textbox')).toHaveAttribute('data-line-numbers', 'false');
    });

    it('shows line numbers in Code mode when showLineNumbers is enabled', async () => {
      setup('const a = 1;', TextMode.Code, jest.fn(), true, CodeLanguage.Json);
      await enterWriteMode();

      expect(screen.getByRole('textbox')).toHaveAttribute('data-line-numbers', 'true');
    });

    it('hides line numbers in Code mode when showLineNumbers is disabled', async () => {
      setup('const a = 1;', TextMode.Code, jest.fn(), false, CodeLanguage.Json);
      await enterWriteMode();

      expect(screen.getByRole('textbox')).toHaveAttribute('data-line-numbers', 'false');
    });
  });
});
