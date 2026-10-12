import { json } from '@codemirror/lang-json';
import { EditorView } from '@codemirror/view';
import { fireEvent, screen } from '@testing-library/react';

import * as annotations from './annotationValue';
import { schemaAnnotations } from './schemaAnnotations';

let view: EditorView;

afterEach(() => {
  view?.destroy();
  jest.restoreAllMocks();
});

it('scans once for all annotations and reuses their positions for lookup results and folder selection', async () => {
  const scan = jest.spyOn(annotations, 'annotationValues');
  const fetch = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes('/display?')) {
      return new Response(JSON.stringify({ display: [{ displayName: url.endsWith('one') ? 'Alice' : 'Bob' }] }));
    }
    if (url.includes('/folders?')) {
      return new Response(
        JSON.stringify({ items: [{ metadata: { name: 'new-folder' }, spec: { title: 'New folder' } }] })
      );
    }
    return new Response(
      JSON.stringify({ spec: { title: url.endsWith('new-folder') ? 'New folder' : 'Original folder' } })
    );
  });
  const doc = JSON.stringify({
    metadata: {
      annotations: {
        'grafana.app/updatedBy': 'user:two',
        'grafana.app/folder': 'original-folder',
        'grafana.app/createdBy': 'user:one',
      },
    },
  });
  const onSelect = jest.fn();
  view = new EditorView({ doc, extensions: [json(), schemaAnnotations('default', onSelect)], parent: document.body });
  expect(await screen.findByText('Alice')).toBeInTheDocument();
  expect(await screen.findByText('Bob')).toBeInTheDocument();
  await screen.findByText('Original folder');
  expect(scan).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledTimes(3);

  view.dispatch({ selection: { anchor: 5 } });
  expect(scan).toHaveBeenCalledTimes(1);
  view.dispatch({ changes: { from: 0, insert: '\n' } });
  expect(scan).toHaveBeenCalledTimes(2);
  expect(fetch).toHaveBeenCalledTimes(3);

  const picker = screen.getByRole('combobox', { name: 'Folder' });
  fireEvent.focus(picker);
  await screen.findByRole('option', { name: 'New folder (new-folder)' });
  fireEvent.change(picker, { target: { value: 'new-folder' } });
  await screen.findByText('New folder');
  expect(scan).toHaveBeenCalledTimes(3);
  expect(onSelect).toHaveBeenCalledWith('\n' + doc.replace('original-folder', 'new-folder'));
  expect(screen.getByText('Alice')).toBeInTheDocument();
  expect(screen.getByText('Bob')).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(5);
});

it.each(annotations.annotationNames)(
  'places the %s widget after a following comma and moves it back when removed',
  (name) => {
    jest.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    const prefix = `{"metadata":{"annotations":{"${name}":"uid"`;
    const doc = prefix + ' ,"other":"value"}}}';
    view = new EditorView({ doc, extensions: [json(), schemaAnnotations('default')], parent: document.body });
    const widget = () => view.dom.querySelector<HTMLElement>('.cm-folder-picker, .cm-identity-label')!;
    expect(view.posAtDOM(widget())).toBe(prefix.length + 2);
    expect(view.state.doc.toString()).toBe(doc);

    view.dispatch({ changes: { from: prefix.length, to: doc.length, insert: '}}}' } });
    expect(view.posAtDOM(widget())).toBe(prefix.length);
    expect(view.state.doc.toString()).toBe(prefix + '}}}');
  }
);
