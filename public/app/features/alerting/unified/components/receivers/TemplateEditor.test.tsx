/* eslint-disable testing-library/no-node-access */
import { EditorView } from '@codemirror/view';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';

import { ErrorBoundaryAlert, LoadingPlaceholder } from '@grafana/ui';

import { TemplateEditor } from './TemplateEditor';

describe('TemplateEditor', () => {
  it('keeps draft edits until blur and accepts external content replacements', async () => {
    const user = userEvent.setup();
    const onBlur = jest.fn();
    const { rerender } = render(
      <TemplateEditor value="Original" onBlur={onBlur} aria-label="Template" width={400} height="300px" />
    );
    const editor = await screen.findByRole('textbox', { name: 'Template' });

    await user.click(editor);
    await user.keyboard('{Control>}{End}{/Control}');
    await user.paste(' draft');
    rerender(<TemplateEditor value="Original" onBlur={onBlur} aria-label="Template" width={600} height="500px" />);

    expect(editor).toHaveTextContent('Original draft');
    expect(onBlur).not.toHaveBeenCalled();
    expect(editor.closest('.cm-editor')).toHaveStyle({ height: '500px' });
    expect(editor.closest('.cm-editor')?.parentElement?.parentElement).toHaveStyle({ width: '600px' });

    await user.click(document.body);
    expect(onBlur).toHaveBeenLastCalledWith('Original draft');

    rerender(<TemplateEditor value="Generated replacement" onBlur={onBlur} aria-label="Template" />);
    await waitFor(() => expect(editor).toHaveTextContent('Generated replacement'));
    await user.click(editor);
    await user.click(document.body);
    expect(onBlur).toHaveBeenLastCalledWith('Generated replacement');
  });

  it('uses Alerting completion to insert fields and snippets', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<TemplateEditor value="{{ .Sta" aria-label="Template" />);
    const editor = await screen.findByRole('textbox', { name: 'Template' });

    await user.click(editor);
    await user.keyboard('{Control>}{End}{/Control}{Control>} {/Control}');
    const status = await screen.findByRole('option', { name: /^Sta\s*tus string$/ });
    await user.click(status);
    expect(editor).toHaveTextContent('{{ .Status');

    rerender(<TemplateEditor value="alertsloop" aria-label="Template" />);
    await waitFor(() => expect(editor).toHaveTextContent('alertsloop'));
    await user.keyboard('{Control>}{End}{/Control}{Control>} {/Control}');
    await user.click(await screen.findByRole('option', { name: /alertsloop/ }));
    expect(EditorView.findFromDOM(editor)?.state.doc.toString()).toBe(
      '\n{{ range .Alerts }}\n  Status: {{ .Status }}\n  Starts at: {{ .StartsAt }}\n{{ end }}\n'
    );
  });

  it('keeps previews selectable while rejecting edits', async () => {
    const user = userEvent.setup();
    render(
      <TemplateEditor value="{{ .Status }}" readOnly height="auto" showLineNumbers={false} aria-label="Template" />
    );
    const editor = await screen.findByRole('textbox', { name: 'Template' });

    expect(EditorView.findFromDOM(editor)?.state.readOnly).toBe(true);
    expect(editor.closest('.cm-editor')).toHaveStyle({ height: 'auto' });
    expect(editor.closest('.cm-editor')?.querySelector('.cm-lineNumbers')).not.toBeInTheDocument();
    await user.click(editor);
    await user.keyboard('{Control>}a{/Control}');
    expect((await user.copy())?.getData('text/plain')).toBe('{{ .Status }}');
    await user.paste('Changed');
    expect(editor).toHaveTextContent('{{ .Status }}');
  });

  it('keeps the surrounding form mounted when the template extension fails to load', async () => {
    let UnloadedTemplateEditor = TemplateEditor;
    jest.isolateModules(() => {
      jest.doMock('react', () => React);
      jest.doMock('@grafana/ui', () => ({ ErrorBoundaryAlert, LoadingPlaceholder }));
      UnloadedTemplateEditor = jest.requireActual('./TemplateEditor').TemplateEditor;
    });
    jest.doMock('./editor/goTemplate', () => {
      throw new Error('Failed to load template extension');
    });
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      render(
        <ErrorBoundaryAlert title="Page failed">
          <input aria-label="Contact point name" defaultValue="Unsaved contact point" />
          <UnloadedTemplateEditor value="Template" aria-label="Template" />
        </ErrorBoundaryAlert>
      );
      const name = screen.getByRole('textbox', { name: 'Contact point name' });

      expect(await screen.findByText('CodeMirror editor failed to load')).toBeInTheDocument();
      expect(name).toBeInTheDocument();
      expect(name).toHaveValue('Unsaved contact point');
    } finally {
      consoleError.mockRestore();
      jest.dontMock('react');
      jest.dontMock('@grafana/ui');
      jest.dontMock('./editor/goTemplate');
    }
  });
});
