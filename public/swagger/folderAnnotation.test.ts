import { json } from '@codemirror/lang-json';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { fireEvent, screen, waitFor } from '@testing-library/react';

import { schemaAnnotations as folderAnnotation } from './schemaAnnotations';

let view: EditorView;

function annotation() {
  return view.dom.querySelector('.cm-folder-annotation');
}

function setup(doc: string, namespace?: string, onSelect?: (text: string) => void, readOnly = false) {
  view = new EditorView({
    doc,
    extensions: [json(), folderAnnotation(namespace, onSelect), EditorState.readOnly.of(readOnly)],
    parent: document.body,
  });
}

afterEach(() => {
  view?.destroy();
  jest.restoreAllMocks();
});

const example = JSON.stringify({
  metadata: { annotations: { 'grafana.app/folder': '{folder-name}' } },
  spec: { annotations: { 'grafana.app/folder': 'not-a-folder-reference' } },
});

it('shows the status immediately after the underlined folder value without changing the JSON', () => {
  setup(example);

  const label = screen.getByRole('combobox', { name: 'Folder' });
  expect(label).toHaveValue('{folder-name}');
  expect(label).toHaveDisplayValue('Folder status unknown');
  expect(label).toHaveAttribute('title', 'select folder');
  expect(annotation()!.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(label.parentElement === annotation()!.parentElement).toBe(true);
  expect(annotation()).not.toHaveAttribute('title');
  expect(label).toHaveAttribute('contenteditable', 'false');
  expect(view.state.doc.toString()).toBe(example);
  expect(annotation()).toHaveTextContent('"{folder-name}"');
  expect(annotation()).toHaveStyle({ textDecoration: 'underline', textDecorationColor: 'gray' });
  expect(screen.getAllByText('Folder status unknown')).toHaveLength(1);
});

it.each([
  ['removed', '{}'],
  ['non-string', '{"metadata":{"annotations":{"grafana.app/folder":null}}}'],
  ['wrong path', '{"spec":{"metadata":{"annotations":{"grafana.app/folder":"other"}}}}'],
])('removes the decoration and picker when the annotation is %s', (_name, doc) => {
  setup(example);
  expect(screen.getByRole('combobox', { name: 'Folder' })).toHaveValue('{folder-name}');

  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: doc } });
  expect(screen.queryByText('Folder status unknown')).not.toBeInTheDocument();
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
});

it('updates the decoration as the JSON is edited, including escaped property names', () => {
  setup(example);
  expect(annotation()).toHaveTextContent('"{folder-name}"');

  view.dispatch({
    changes: {
      from: 0,
      to: view.state.doc.length,
      insert: '{"metadata":{"annotations":{"grafana.app\\/folder":"updated"}}}',
    },
  });
  expect(annotation()).toHaveTextContent('"updated"');
});

function folder(title: string) {
  return new Response(JSON.stringify({ spec: { title } }));
}

it('looks up the encoded namespace and UID, removing the underline once the folder resolves', async () => {
  const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(folder('Production'));
  setup(example, 'my namespace');
  expect(screen.getByText('Loading folder…')).toBeInTheDocument();
  expect(annotation()).toHaveStyle({ textDecorationColor: 'gray' });

  expect(await screen.findByText('Production')).toBeInTheDocument();
  expect(annotation()).toHaveStyle({ textDecoration: 'none' });
  expect(fetch).toHaveBeenCalledWith(
    'apis/folder.grafana.app/v1/namespaces/my%20namespace/folders/%7Bfolder-name%7D',
    expect.objectContaining({ signal: expect.any(AbortSignal) })
  );
  view.dispatch({ changes: { from: 0, insert: ' ' } });
  expect(fetch).toHaveBeenCalledTimes(1);
});

it.each([404, 403, 500])('marks an unresolved folder red when the endpoint returns %s', async (status) => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status }));
  setup(example, 'default');
  expect(await screen.findByText('Folder could not be resolved')).toBeInTheDocument();
  expect(annotation()).toHaveStyle({ textDecorationColor: 'red' });
});

it('marks a failed network lookup red', async () => {
  jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network unavailable'));
  setup(example, 'default');
  expect(await screen.findByText('Folder could not be resolved')).toBeInTheDocument();
  expect(annotation()).toHaveStyle({ textDecorationColor: 'red' });
});

it('keeps the status unknown without a namespace and does not fetch', () => {
  const fetch = jest.spyOn(globalThis, 'fetch');
  setup(example);
  expect(screen.getByText('Folder status unknown')).toBeInTheDocument();
  expect(annotation()).toHaveStyle({ textDecorationColor: 'gray' });
  expect(fetch).not.toHaveBeenCalled();
});

it('aborts obsolete lookups and ignores their responses after the UID changes', async () => {
  let resolveOld!: (response: Response) => void;
  const fetch = jest
    .spyOn(globalThis, 'fetch')
    .mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveOld = resolve;
      })
    )
    .mockResolvedValueOnce(folder('Current folder'));
  setup(example, 'default');
  const signal = fetch.mock.calls[0][1]?.signal;
  expect(screen.getByText('Loading folder…')).toBeInTheDocument();
  expect(annotation()).toHaveStyle({ textDecorationColor: 'gray' });

  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: example.replace('{folder-name}', 'new-uid') },
  });
  expect(signal?.aborted).toBe(true);
  expect(await screen.findByText('Current folder')).toBeInTheDocument();
  expect(annotation()).toHaveStyle({ textDecoration: 'none' });
  resolveOld(folder('Old folder'));
  await waitFor(() => expect(annotation()).toHaveTextContent('"new-uid"'));
  expect(screen.queryByText('Old folder')).not.toBeInTheDocument();
});

it('returns to gray when a resolved UID is edited and aborts the pending request on destroy', async () => {
  const fetch = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(folder('Original folder'))
    .mockReturnValueOnce(new Promise(() => {}));
  setup(example, 'default');
  expect(await screen.findByText('Original folder')).toBeInTheDocument();
  expect(annotation()).toHaveStyle({ textDecoration: 'none' });

  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: example.replace('{folder-name}', 'new-uid') },
  });
  expect(screen.getByText('Loading folder…')).toBeInTheDocument();
  expect(annotation()).toHaveStyle({ textDecorationColor: 'gray' });
  view.destroy();
  expect(fetch.mock.calls[1][1]?.signal?.aborted).toBe(true);
});

it('loads folders and writes the selected UID into only the annotation, then commits the JSON', async () => {
  const onSelect = jest.fn();
  const fetch = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(folder('Original'))
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [{ metadata: { name: 'new-uid' }, spec: { title: 'Production' } }],
        })
      )
    )
    .mockResolvedValueOnce(folder('Production'));
  setup(example, 'default', onSelect);
  await screen.findByText('Original');
  const picker = screen.getByRole('combobox', { name: 'Folder' });
  expect(picker).toHaveValue('{folder-name}');
  fireEvent.focus(picker);
  await screen.findByRole('option', { name: 'Production (new-uid)' });
  expect(fetch).toHaveBeenNthCalledWith(
    2,
    'apis/folder.grafana.app/v1/namespaces/default/folders?limit=100',
    expect.any(Object)
  );
  fireEvent.change(picker, { target: { value: 'new-uid' } });
  expect(view.state.doc.toString()).toBe(example.replace('{folder-name}', 'new-uid'));
  expect(onSelect).toHaveBeenCalledWith(example.replace('{folder-name}', 'new-uid'));
  await screen.findByText('Production');
  expect(screen.getByRole('combobox', { name: 'Folder' })).toHaveValue('new-uid');
  fireEvent.click(annotation()!);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('disables the picker for a read-only editor', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(folder('Original'));
  setup(example, 'default', undefined, true);
  await screen.findByText('Original');
  expect(screen.getByRole('combobox', { name: 'Folder' })).toBeDisabled();
});

it('loads subsequent pages of folders', async () => {
  const fetch = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(folder('Original'))
    .mockResolvedValueOnce(new Response(JSON.stringify({ items: [], metadata: { continue: 'next-page' } })))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [{ metadata: { name: 'last' }, spec: { title: 'Last folder' } }] }))
    );
  setup(example, 'default');
  await screen.findByText('Original');
  fireEvent.focus(screen.getByRole('combobox', { name: 'Folder' }));
  expect(await screen.findByRole('option', { name: 'Last folder (last)' })).toHaveValue('last');
  expect(fetch).toHaveBeenLastCalledWith(
    'apis/folder.grafana.app/v1/namespaces/default/folders?limit=100&continue=next-page',
    expect.any(Object)
  );
});

it('aborts folder listing when the annotation is removed after another editor update', async () => {
  const fetch = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(folder('Original'))
    .mockReturnValueOnce(new Promise(() => {}));
  setup(example, 'default');
  await screen.findByText('Original');
  fireEvent.focus(screen.getByRole('combobox', { name: 'Folder' }));
  expect(screen.getByRole('option', { name: 'Loading folders…' })).toBeDisabled();
  view.dispatch({ changes: { from: 0, insert: ' ' } });
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '{}' } });
  expect(fetch.mock.calls[1][1]?.signal?.aborted).toBe(true);
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
});

it('shows folder listing errors and retries on the next focus', async () => {
  jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(folder('Original'))
    .mockResolvedValueOnce(new Response(null, { status: 500 }))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [{ metadata: { name: 'retry' }, spec: { title: 'Retry folder' } }] }))
    );
  setup(example, 'default');
  await screen.findByText('Original');
  const picker = screen.getByRole('combobox', { name: 'Folder' });
  fireEvent.focus(picker);
  expect(await screen.findByRole('option', { name: 'Could not load folders. Focus again to retry.' })).toBeDisabled();
  fireEvent.blur(picker);
  fireEvent.focus(picker);
  expect(await screen.findByRole('option', { name: 'Retry folder (retry)' })).toHaveValue('retry');
});
