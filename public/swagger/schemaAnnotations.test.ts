import { json } from '@codemirror/lang-json';
import { EditorView } from '@codemirror/view';

import * as annotations from './annotationValue';
import { schemaAnnotations } from './schemaAnnotations';

let view: EditorView;

afterEach(() => {
  view?.destroy();
  jest.restoreAllMocks();
});

it.each(annotations.annotationNames.filter((name) => name !== 'grafana.app/folder'))(
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
