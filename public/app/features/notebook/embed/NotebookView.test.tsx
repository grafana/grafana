import { act, render, screen } from 'test/test-utils';

import { SceneRefreshPicker, SceneTimePicker, SceneTimeRange } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { contextSrv } from 'app/core/services/context_srv';

import * as notebookResource from '../api/notebookResource';
import { markdownCell } from '../mutation-api/test-utils';
import { NotebookPageStateManager } from '../pages/NotebookPageStateManager';
import { NotebookScene } from '../scene/NotebookScene';
import { NotebookLayoutManager } from '../scene/layout-notebook/NotebookLayoutManager';
import * as transformModule from '../serialization/transformNotebookToScene';
import { defaultSpec as defaultNotebookSpec, type Spec as NotebookSpec } from '../types';

import { NotebookView } from './NotebookView';

const NOTEBOOKS_FLAG = 'dashboard.notebooks';

/**
 * The manager this component builds for itself, captured as it is asked to load. Stubbing the load
 * is what keeps these tests off the network; capturing `this` is the only way to reach an instance
 * the component owns, which is the whole point of it not using the shared one.
 */
function captureStateManager() {
  const instances: NotebookPageStateManager[] = [];
  const loadedUids: string[] = [];

  jest.spyOn(NotebookPageStateManager.prototype, 'loadNotebook').mockImplementation(async function (
    this: NotebookPageStateManager,
    uid: string
  ) {
    instances.push(this);
    loadedUids.push(uid);
  });

  return { instances, loadedUids };
}

function aNotebookScene(title = 'Checkout latency investigation') {
  return new NotebookScene({
    title,
    uid: 'nb-1',
    body: new NotebookLayoutManager({ cells: [] }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    timePicker: new SceneTimePicker({}),
    refreshPicker: new SceneRefreshPicker({}),
  });
}

describe('NotebookView', () => {
  afterEach(async () => {
    await act(async () => {
      setTestFlags({});
    });
    jest.restoreAllMocks();
  });

  // The host is a plugin, which cannot see the flag: rendering nothing is what stops a notebook
  // appearing on an instance where the feature is off.
  it('renders nothing when the feature flag is off', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: false });
    const { loadedUids } = captureStateManager();

    const { container } = render(<NotebookView uid="nb-1" />);

    expect(container).toBeEmptyDOMElement();
    // Not merely invisible: nothing was requested either.
    expect(loadedUids).toEqual([]);
  });

  it('loads the notebook it was given', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    const { loadedUids } = captureStateManager();

    render(<NotebookView uid="nb-7" />);

    expect(loadedUids).toEqual(['nb-7']);
  });

  // The reason this component exists: the same editable document the route renders, with no route.
  it('renders the editable document once it has loaded', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    // The edit toggle is the thing being asserted, and it is hidden without write permission.
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
    const { instances } = captureStateManager();

    render(<NotebookView uid="nb-1" />);

    await act(async () => {
      instances[0].setState({ isLoading: false, scene: aNotebookScene() });
    });

    expect(await screen.findByRole('radio', { name: 'Edit' })).toBeInTheDocument();
  });

  // The sticky controls row offsets itself by the app header's height, which is not this host's
  // coordinate space -- left alone the row floats over the first cells as they scroll past it.
  /**
   * It renders without an app header above it, but it must not say so ON THE SCENE: the same scene
   * object is shared with the /notebooks route, which does have one, so a flag there would answer
   * for both and leave the route's sticky controls row under its header. The answer travels with the
   * tree instead — see NotebookEmbeddedContext.
   */
  it('does not mark the shared scene as embedded', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    const { instances } = captureStateManager();
    const scene = aNotebookScene();

    render(<NotebookView uid="nb-1" />);

    await act(async () => {
      instances[0].setState({ isLoading: false, scene });
    });

    expect('embedded' in scene.state).toBe(false);
  });

  // A host that shows this in a tab has only this to label the tab with.
  it('reports the title to its host', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    const { instances } = captureStateManager();
    const onTitleChange = jest.fn();

    render(<NotebookView uid="nb-1" onTitleChange={onTitleChange} />);

    await act(async () => {
      instances[0].setState({ isLoading: false, scene: aNotebookScene('Q2 latency regression') });
    });

    expect(onTitleChange).toHaveBeenCalledWith('Q2 latency regression');
  });

  // Without the route's breadcrumb to carry it, the body is the only place the difference between
  // "no such notebook" and "we could not fetch it" can show.
  it('says so when the notebook does not exist', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    const { instances } = captureStateManager();

    render(<NotebookView uid="gone" />);

    await act(async () => {
      instances[0].setState({ isLoading: false, loadError: { status: 404, message: 'not found' } });
    });

    expect(await screen.findByText(/Notebook not found/i)).toBeInTheDocument();
    expect(screen.queryByTestId('notebook-view-error')).not.toBeInTheDocument();
  });

  it('surfaces the detail of any other failure', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    const { instances } = captureStateManager();

    render(<NotebookView uid="nb-1" />);

    await act(async () => {
      instances[0].setState({ isLoading: false, loadError: { status: 403, message: 'You lack permission' } });
    });

    expect(await screen.findByTestId('notebook-view-error')).toHaveTextContent('You lack permission');
  });

  // Its manager is its own, so nothing else clears it: a host unmounting the tab has to leave no
  // scene behind, or the next notebook opened here flashes the previous one first.
  it('drops its notebook when the host unmounts it', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    const { instances } = captureStateManager();

    const { unmount } = render(<NotebookView uid="nb-1" />);

    await act(async () => {
      instances[0].setState({ isLoading: false, scene: aNotebookScene() });
    });

    await act(async () => {
      unmount();
    });

    expect(instances[0].state.scene).toBeUndefined();
  });

  // A host holding a document nobody has chosen to save: the assistant's canvas, where a notebook is
  // edited against the conversation and only becomes a resource when someone publishes it.
  describe('a draft', () => {
    /** A document with no cells, off the generated default so every field the transform reads is there. */
    function aDraftSpec(title = 'Untitled investigation'): NotebookSpec {
      return { ...defaultNotebookSpec(), title };
    }

    /** The same, with one markdown cell — needed by anything that edits a cell rather than a root field. */
    function aDraftSpecWithCell(text = 'original text'): NotebookSpec {
      return {
        ...aDraftSpec(),
        elements: { intro: markdownCell(text) },
        layout: {
          kind: 'NotebookLayout',
          spec: {
            cells: [
              {
                kind: 'NotebookLayoutItem',
                spec: { element: { kind: 'ElementReference', name: 'intro' }, source: 'assistant' },
              },
            ],
          },
        },
      };
    }

    /** The cell the draft was seeded with, by the element it references. */
    function seededCell(scene: NotebookScene) {
      const cell = scene.state.body.state.cells.find((c) => c.state.elementName === 'intro');
      if (!cell) {
        throw new Error('the draft was built without its seeded cell');
      }
      return cell;
    }

    /** The scene a draft builds for itself — there is no other handle on it. */
    function captureDraftScene() {
      const scenes: NotebookScene[] = [];
      const real = transformModule.transformNotebookToScene;
      jest.spyOn(transformModule, 'transformNotebookToScene').mockImplementation((resource) => {
        const scene = real(resource);
        scenes.push(scene);
        return scene;
      });
      return () => scenes[0];
    }

    it('creates no notebook resource, however long it is edited', async () => {
      jest.useFakeTimers();
      setTestFlags({ [NOTEBOOKS_FLAG]: true });
      const createNotebook = jest.spyOn(notebookResource, 'createNotebook');
      const updateNotebook = jest.spyOn(notebookResource, 'updateNotebook');
      const draftScene = captureDraftScene();

      render(<NotebookView spec={aDraftSpec()} onChange={jest.fn()} />);

      // Both halves are needed for autosave to treat this as a writer edit: it ignores changes made
      // outside edit mode, and the mode switch alone is compared against the baseline recorded at
      // start and writes nothing. Miss either and this passes whether or not the draft is suppressed.
      await act(async () => {
        draftScene().setState({ isEditing: true });
      });
      await act(async () => {
        draftScene().setState({ title: 'Edited while still a draft' });
        // Well past autosave's 2s debounce and its 15s maxWait.
        jest.advanceTimersByTime(30_000);
      });

      expect(createNotebook).not.toHaveBeenCalled();
      expect(updateNotebook).not.toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('renders the document without asking the API for one', async () => {
      setTestFlags({ [NOTEBOOKS_FLAG]: true });
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
      const { loadedUids } = captureStateManager();

      render(<NotebookView spec={aDraftSpec()} />);

      // Editable, and nothing was fetched: a draft has no uid to load.
      expect(await screen.findByRole('radio', { name: 'Edit' })).toBeInTheDocument();
      expect(loadedUids).toEqual([]);
    });

    it('reports its title to the host', async () => {
      setTestFlags({ [NOTEBOOKS_FLAG]: true });
      const onTitleChange = jest.fn();

      render(<NotebookView spec={aDraftSpec('Checkout latency')} onTitleChange={onTitleChange} />);

      expect(onTitleChange).toHaveBeenCalledWith('Checkout latency');
    });

    /**
     * The edit that matters, and the one the previous version of this test missed.
     *
     * Cell edits call `setState` on the CELL, not on the scene root, so a root-level
     * `subscribeToState` never heard them — every edit but the title was silently dropped. Driven
     * through the layout manager here rather than through a root field for exactly that reason: a
     * test that mutates `title` passes against the broken subscription.
     */
    it('reports an edit made to a cell, not just to the document title', async () => {
      jest.useFakeTimers();
      setTestFlags({ [NOTEBOOKS_FLAG]: true });
      const onChange = jest.fn();
      const draftScene = captureDraftScene();

      render(<NotebookView spec={aDraftSpecWithCell()} onChange={onChange} />);

      await act(async () => {
        const scene = draftScene();
        scene.state.body.setCellContent(seededCell(scene), {
          kind: 'Markdown',
          spec: { text: 'p99 rose after the deploy' },
        });
        jest.advanceTimersByTime(3000);
      });

      expect(onChange).toHaveBeenCalled();
      expect(JSON.stringify(onChange.mock.calls.at(-1)?.[0])).toContain('p99 rose after the deploy');
      jest.useRealTimers();
    });

    // Scene events bubble, so a panel refresh reaches this subscription too. Reporting on one would
    // have the host writing a snapshot per refresh tick for a document nobody touched.
    it('reports nothing when the document itself did not change', async () => {
      jest.useFakeTimers();
      setTestFlags({ [NOTEBOOKS_FLAG]: true });
      const onChange = jest.fn();
      const draftScene = captureDraftScene();

      render(<NotebookView spec={aDraftSpec()} onChange={onChange} />);

      await act(async () => {
        // A state change that is not part of the serialized document, as a query runner's results
        // are not: the event fires, the document is identical, so nothing is reported.
        draftScene().setState({ isEditing: true });
        jest.advanceTimersByTime(3000);
      });

      expect(onChange).not.toHaveBeenCalled();
      jest.useRealTimers();
    });

    // Without a way back out, an edit to a draft dies with the component.
    it('hands the edited document back to the host', async () => {
      jest.useFakeTimers();
      setTestFlags({ [NOTEBOOKS_FLAG]: true });
      const onChange = jest.fn();
      const onDirtyChange = jest.fn();
      const draftScene = captureDraftScene();

      render(<NotebookView spec={aDraftSpec('Before')} onChange={onChange} onDirtyChange={onDirtyChange} />);

      await act(async () => {
        draftScene().setState({ title: 'After' });
        expect(onDirtyChange).toHaveBeenLastCalledWith(true);
        expect(onChange).not.toHaveBeenCalled();
        jest.advanceTimersByTime(3000);
      });

      expect(onDirtyChange).toHaveBeenLastCalledWith(false);
      expect(onChange).toHaveBeenCalled();
      expect(onChange.mock.calls.at(-1)?.[0]).toMatchObject({ title: 'After' });
      jest.useRealTimers();
    });

    // The debounce must not swallow the last edit when the host closes the tab.
    it('flushes a pending edit on unmount', async () => {
      jest.useFakeTimers();
      setTestFlags({ [NOTEBOOKS_FLAG]: true });
      const onChange = jest.fn();
      const draftScene = captureDraftScene();

      const { unmount } = render(<NotebookView spec={aDraftSpecWithCell()} onChange={onChange} />);

      await act(async () => {
        const scene = draftScene();
        scene.state.body.setCellContent(seededCell(scene), {
          kind: 'Markdown',
          spec: { text: 'typed then closed' },
        });
        // Deliberately inside the debounce window, so only the unmount flush can report it.
        jest.advanceTimersByTime(100);
      });
      expect(onChange).not.toHaveBeenCalled();

      await act(async () => {
        unmount();
      });

      expect(JSON.stringify(onChange.mock.calls.at(-1)?.[0])).toContain('typed then closed');
      jest.useRealTimers();
    });
  });
});
