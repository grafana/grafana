import { insertElement, newMarkdownElement, newNotebookSpec, updateMarkdownText } from '../model/notebookSpec';

import { mergeRemoteSpec } from './mergeRemoteSpec';

describe('mergeRemoteSpec', () => {
  function setup() {
    let spec = newNotebookSpec('nb');
    const a = insertElement(spec, newMarkdownElement('a'));
    const b = insertElement(a.spec, newMarkdownElement('b'));
    return { spec: b.spec, aKey: a.elementName, bKey: b.elementName };
  }

  it('returns the remote spec when not editing', () => {
    const { spec } = setup();
    const remote = updateMarkdownText(spec, Object.keys(spec.elements)[0], 'remote edit');

    expect(mergeRemoteSpec(remote, spec, null)).toBe(remote);
    expect(mergeRemoteSpec(remote, undefined, 'anything')).toBe(remote);
  });

  it('keeps the locally edited cell while taking remote changes elsewhere', () => {
    const { spec, aKey, bKey } = setup();
    const local = updateMarkdownText(spec, aKey, 'local typing in progress');
    const remote = updateMarkdownText(spec, bKey, 'remote edit');

    const merged = mergeRemoteSpec(remote, local, aKey);

    const mergedA = merged.elements[aKey];
    const mergedB = merged.elements[bKey];
    if (mergedA.kind !== 'Cell' || mergedA.spec.content.kind !== 'Markdown') {
      throw new Error('expected markdown cell');
    }
    if (mergedB.kind !== 'Cell' || mergedB.spec.content.kind !== 'Markdown') {
      throw new Error('expected markdown cell');
    }
    expect(mergedA.spec.content.spec.text).toBe('local typing in progress');
    expect(mergedB.spec.content.spec.text).toBe('remote edit');
  });

  it('accepts a remote deletion of the cell being edited', () => {
    const { spec, aKey } = setup();
    const local = updateMarkdownText(spec, aKey, 'local typing');
    const remote = { ...spec, elements: { ...spec.elements } };
    delete remote.elements[aKey];

    expect(mergeRemoteSpec(remote, local, aKey)).toBe(remote);
  });
});
