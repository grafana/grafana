import { json } from '@codemirror/lang-json';
import { EditorView } from '@codemirror/view';
import { screen } from '@testing-library/react';

import { schemaAnnotations as identityAnnotations } from './schemaAnnotations';

let view: EditorView;
const doc = JSON.stringify({
  metadata: { annotations: { 'grafana.app/createdBy': 'user:one', 'grafana.app/updatedBy': 'user:two' } },
  spec: { annotations: { 'grafana.app/createdBy': 'not-an-identity' } },
});

function setup(value = doc, namespace?: string) {
  view = new EditorView({ doc: value, extensions: [json(), identityAnnotations(namespace)], parent: document.body });
}

function display(displayName: string) {
  return new Response(JSON.stringify({ display: [{ displayName }] }));
}

afterEach(() => {
  view?.destroy();
  jest.restoreAllMocks();
});

it('resolves both metadata annotations independently and leaves the saved JSON unchanged', async () => {
  const fetch = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(display('Alice'))
    .mockResolvedValueOnce(display('Bob'));
  setup();
  expect(screen.getAllByText('Loading identity…')).toHaveLength(2);
  expect(await screen.findByText('Alice')).toHaveAttribute('contenteditable', 'false');
  expect(await screen.findByText('Bob')).toHaveAttribute('contenteditable', 'false');
  for (const value of view.dom.querySelectorAll('.cm-identity-annotation')) {
    expect(value).toHaveStyle({ textDecoration: 'none' });
  }
  expect(fetch).toHaveBeenNthCalledWith(
    1,
    'apis/iam.grafana.app/v0alpha1/namespaces/default/display?key=user%3Aone',
    expect.any(Object)
  );
  expect(fetch).toHaveBeenNthCalledWith(
    2,
    'apis/iam.grafana.app/v0alpha1/namespaces/default/display?key=user%3Atwo',
    expect.any(Object)
  );
  view.dispatch({ changes: { from: 0, insert: ' ' } });
  expect(view.state.doc.toString()).toBe(' ' + doc);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('encodes namespace and identity keys and renders display names as text', async () => {
  const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(display('<b>Alice</b>'));
  setup('{"metadata":{"annotations":{"grafana.app/createdBy":"user:a&b"}}}', 'stack/name');
  expect(await screen.findByText('<b>Alice</b>')).toHaveTextContent('<b>Alice</b>');
  expect(view.dom.querySelector('.cm-identity-label b')).toBeNull();
  expect(fetch).toHaveBeenCalledWith(
    'apis/iam.grafana.app/v0alpha1/namespaces/stack%2Fname/display?key=user%3Aa%26b',
    expect.any(Object)
  );
});

it.each([
  ['not found', () => Promise.resolve(new Response(JSON.stringify({ display: [] })))],
  ['invalid key', () => Promise.resolve(new Response(JSON.stringify({ invalidKeys: ['user:one'], display: [] })))],
  ['HTTP error', () => Promise.resolve(new Response(null, { status: 403 }))],
  ['network error', () => Promise.reject(new Error('Offline'))],
])('shows an unresolved label for %s', async (_name, response) => {
  jest.spyOn(globalThis, 'fetch').mockImplementation(response);
  setup('{"metadata":{"annotations":{"grafana.app/createdBy":"user:one"}}}');
  expect(await screen.findByText('Identity could not be resolved')).toBeInTheDocument();
  expect(view.state.doc.toString()).toContain('user:one');
  expect(view.dom.querySelector('.cm-identity-annotation')).toHaveStyle({
    textDecoration: 'underline',
    textDecorationColor: 'red',
  });
});

it('ignores obsolete responses and removes labels when annotations are removed', async () => {
  let resolveOld!: (response: Response) => void;
  const fetch = jest
    .spyOn(globalThis, 'fetch')
    .mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveOld = resolve;
      })
    )
    .mockResolvedValueOnce(display('New user'));
  const initial = '{"metadata":{"annotations":{"grafana.app/createdBy":"user:one"}}}';
  setup(initial);
  const oldSignal = fetch.mock.calls[0][1]?.signal;
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: initial.replace('user:one', 'user:new') } });
  expect(await screen.findByText('New user')).toBeInTheDocument();
  expect(oldSignal?.aborted).toBe(true);
  resolveOld(display('Old user'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(screen.queryByText('Old user')).not.toBeInTheDocument();
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '{}' } });
  expect(screen.queryByText('New user')).not.toBeInTheDocument();
});

it('does not look up empty or non-string identities and aborts on destroy', () => {
  const fetch = jest.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
  setup('{"metadata":{"annotations":{"grafana.app/createdBy":"","grafana.app/updatedBy":null}}}');
  expect(screen.getByText('Identity unknown')).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: doc } });
  expect(fetch).toHaveBeenCalledTimes(2);
  view.destroy();
  expect(fetch.mock.calls.every((call) => call[1]?.signal?.aborted)).toBe(true);
});
