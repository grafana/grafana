import { language } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { render } from 'test/test-utils';

import { store } from '@grafana/data';

import { setupMswServer } from '../../mockApi';

import { AlertmanagerConfigurationVersionManager } from './VersionManager';
import history from './mocks/api/alertmanager/grafana/config/history.json';

const server = setupMswServer();

beforeEach(() => {
  window.localStorage.removeItem('grafana.monaco-diff-editor.inline');
  server.use(
    http.get('/api/alertmanager/grafana/config/history', () =>
      HttpResponse.json([
        { ...history[0], template_files: { 'test.tmpl': 'current template' } },
        { ...history[1], template_files: { 'test.tmpl': 'previous template' } },
      ])
    )
  );
});

afterEach(() => {
  window.localStorage.removeItem('grafana.monaco-diff-editor.inline');
});

it('compares historical JSON with the saved view preference, hidden line numbers and read-only panes', async () => {
  store.set('grafana.monaco-diff-editor.inline', true);
  const { user, container } = render(<AlertmanagerConfigurationVersionManager alertmanagerName="grafana" />);

  await user.click(await screen.findByRole('button', { name: 'Compare' }));

  expect(await screen.findByRole('textbox', { name: 'Modified' })).toHaveTextContent('current template');
  expect(screen.getByRole('radio', { name: 'Inline' })).toBeChecked();
  expect(screen.queryByRole('textbox', { name: 'Original' })).not.toBeInTheDocument();

  await user.click(screen.getByRole('radio', { name: 'Side by side' }));

  expect(screen.getByRole('textbox', { name: 'Original' })).toHaveTextContent('previous template');
  expect(screen.getByRole('textbox', { name: 'Modified' })).toHaveTextContent('current template');
  for (const editor of screen.getAllByRole('textbox')) {
    await waitFor(() => expect(EditorView.findFromDOM(editor)?.state.facet(language)?.name).toBe('json'));
    expect(EditorView.findFromDOM(editor)?.state.readOnly).toBe(true);
    expect(editor).toHaveAttribute('contenteditable', 'false');
    expect(editor).not.toHaveTextContent(/last_applied|"id"/);
  }
  // Line-number gutters have no accessible role or label.
  // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
  expect(container.querySelector('.cm-lineNumbers')).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Return' }));
  await user.click(screen.getByRole('button', { name: 'Compare' }));

  expect(await screen.findByRole('textbox', { name: 'Original' })).toHaveTextContent('previous template');
  expect(screen.getByRole('radio', { name: 'Side by side' })).toBeChecked();
  expect(store.getBool('grafana.monaco-diff-editor.inline', true)).toBe(false);
});

it('restores the compared historical version only after confirmation', async () => {
  const restoredVersions: string[] = [];
  server.use(
    http.post('/api/alertmanager/grafana/config/history/:id/_activate', ({ params }) => {
      restoredVersions.push(String(params.id));
      return HttpResponse.json({ message: 'Configuration restored' });
    })
  );
  const { user } = render(<AlertmanagerConfigurationVersionManager alertmanagerName="grafana" />);

  await user.click(await screen.findByRole('button', { name: 'Compare' }));
  await screen.findByRole('textbox', { name: 'Original' });
  await user.click(screen.getByRole('button', { name: 'Restore' }));

  const confirmation = await screen.findByRole('dialog', { name: 'Restore version' });
  await user.click(within(confirmation).getByRole('button', { name: 'Cancel' }));

  expect(screen.getByRole('textbox', { name: 'Original' })).toHaveTextContent('previous template');
  expect(restoredVersions).toEqual([]);

  await user.click(screen.getByRole('button', { name: 'Restore' }));
  await user.click(screen.getByRole('button', { name: 'Yes, restore configuration' }));

  await waitFor(() => expect(restoredVersions).toEqual(['13648071']));
  expect(await screen.findByRole('button', { name: 'Compare' })).toBeEnabled();
});
