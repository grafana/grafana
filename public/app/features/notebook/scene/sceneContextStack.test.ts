import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { notebookResourceFor } from '../api/notebookResource';
import { NOTEBOOKS_FLAG, notebookSpec } from '../mutation-api/test-utils';
import { transformNotebookToScene } from '../serialization/transformNotebookToScene';

import { findActiveNotebookScene } from './sceneContextStack';

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({ id }).useFieldConfig()),
  getPanelPluginFromCache: () => undefined,
});

const scene = (uid: string) => transformNotebookToScene(notebookResourceFor(uid, notebookSpec()));

beforeEach(() => setTestFlags({ [NOTEBOOKS_FLAG]: true }));
afterEach(() => setTestFlags({}));

describe('findActiveNotebookScene', () => {
  it('finds a notebook only while its scene is mounted', () => {
    const open = scene('nb-1');
    expect(findActiveNotebookScene('nb-1')).toBeUndefined();

    const deactivate = open.activate();
    expect(findActiveNotebookScene('nb-1')).toBe(open);

    deactivate();
    expect(findActiveNotebookScene('nb-1')).toBeUndefined();
  });

  it('prefers the most recently mounted of two scenes showing the same notebook', () => {
    const first = scene('nb-1');
    const second = scene('nb-1');
    const deactivateFirst = first.activate();
    const deactivateSecond = second.activate();

    expect(findActiveNotebookScene('nb-1')).toBe(second);

    deactivateSecond();
    expect(findActiveNotebookScene('nb-1')).toBe(first);
    deactivateFirst();
  });

  it('finds a draft by the uid it was given on its first save', () => {
    const draft = scene('');
    const deactivate = draft.activate();

    draft.setState({ uid: 'nb-new' });

    expect(findActiveNotebookScene('nb-new')).toBe(draft);
    deactivate();
  });
});
