// Set up config before any canvas modules load
jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  actual.config.theme2 = actual.config.theme2 ?? {
    colors: {
      text: { primary: '#000000' },
    },
  };
  return actual;
});

import { ConnectionPath } from 'app/plugins/panel/canvas/panelcfg.gen';
import { LayerActionID } from 'app/plugins/panel/canvas/types';
import { getConnections } from 'app/plugins/panel/canvas/utils';

import { type ElementState } from './element';
import { type FrameState } from './frame';
import { RootElement } from './root';
import { frameSelection } from './sceneElementManagement';

describe('Scene.byName', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockScene: any;
  let root: RootElement;

  beforeEach(() => {
    mockScene = {
      byName: new Map<string, ElementState>(),
      save: jest.fn(),
      clearCurrentSelection: jest.fn(),
      isEditingEnabled: true,
      getNextElementName: jest.fn().mockReturnValue('Auto Element'),
      connections: {
        select: jest.fn(),
        // Mirror the real Connections.updateState: rebuild state from byName so
        // tests exercise the same connection bookkeeping as runtime.
        updateState: jest.fn(() => {
          mockScene.connections.state = getConnections(mockScene.byName);
        }),
        connectionAnchorDiv: null,
        connectionsSVG: null,
        state: [],
      },
      editModeEnabled: {
        subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
        next: jest.fn(),
        getValue: jest.fn().mockReturnValue(false),
      },
      selection: {
        next: jest.fn(),
        subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
      },
      moved: {
        next: jest.fn(),
        subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
      },
      root: null,
      width: 0,
      height: 0,
      div: document.createElement('div'),
      viewerDiv: document.createElement('div'),
      viewportDiv: document.createElement('div'),
      context: {
        getColor: jest.fn().mockReturnValue({ value: () => 'transparent' }),
        getResource: jest.fn(),
      },
      panel: {},
      subscription: { unsubscribe: jest.fn() },
      targetsToSelect: new Set<HTMLDivElement>(),
      revId: 0,
      scale: 1,
      style: {},
    };

    root = new RootElement(
      {
        type: 'frame',
        name: 'Root',
        elements: [
          {
            type: 'frame',
            name: 'ParentFrame',
            // @ts-expect-error - Frame type not discriminated in
            // CanvasElementOptions union in generated CUE types
            elements: [
              {
                type: 'rectangle',
                name: 'ChildRect',
                placement: { top: 0, left: 0, width: 50, height: 50 },
              },
              {
                type: 'text',
                name: 'ChildText',
                placement: { top: 60, left: 0, width: 50, height: 20 },
              },
            ],
          },
          {
            type: 'rectangle',
            name: 'Sibling',
            placement: { top: 0, left: 100, width: 50, height: 50 },
          },
        ],
      },
      mockScene,
      jest.fn()
    );
    mockScene.root = root;
  });

  function rect(x: number, y: number, width: number, height: number) {
    return {
      x,
      y,
      width,
      height,
      top: y,
      left: x,
      right: x + width,
      bottom: y + height,
    } as DOMRect;
  }

  function setRect(element: ElementState, rect: DOMRect) {
    const div = document.createElement('div');
    div.getBoundingClientRect = jest.fn().mockReturnValue(rect);
    element.div = div;
  }

  async function forceCollection(refs: Record<string, WeakRef<object>>) {
    const gc = global.gc;
    if (!gc) {
      throw new Error('Run with node --expose-gc');
    }

    for (let i = 0; i < 50; i++) {
      const pressure = new Array(1000).fill(0).map((_, index) => ({ index }));
      pressure.length = 0;
      gc();
      await new Promise((resolve) => setTimeout(resolve, 0));

      if (Object.values(refs).every((ref) => ref.deref() === undefined)) {
        return;
      }
    }

    const alive = Object.entries(refs)
      .filter(([, ref]) => ref.deref() !== undefined)
      .map(([name]) => name);
    throw new Error(`Deleted canvas objects still reachable after forced GC: ${alive.join(', ')}`);
  }

  it('removes child element entries from byName when a parent frame is deleted', () => {
    expect(mockScene.byName.size).toBe(4);
    expect(mockScene.byName.has('ParentFrame')).toBe(true);
    expect(mockScene.byName.has('ChildRect')).toBe(true);
    expect(mockScene.byName.has('ChildText')).toBe(true);
    expect(mockScene.byName.has('Sibling')).toBe(true);

    const frameElement = root.elements.find((e) => e.options.name === 'ParentFrame')!;
    root.doAction(LayerActionID.Delete, frameElement);

    expect(mockScene.byName.has('ParentFrame')).toBe(false);

    // FrameState.destroy recursively cleans children and clears elements
    const frame = frameElement as FrameState;
    expect(frame.elements).toHaveLength(0);
    expect(frame.div).toBeUndefined();

    // Children are removed from byName when parent frame is deleted
    expect(mockScene.byName.has('ChildRect')).toBe(false);
    expect(mockScene.byName.has('ChildText')).toBe(false);

    // Sibling remains
    expect(mockScene.byName.has('Sibling')).toBe(true);

    // byName should have only 1 entry (sibling)
    expect(mockScene.byName.size).toBe(1);
  });

  it('removes connections that target deleted frame descendants', () => {
    const frameElement = root.elements.find((e) => e.options.name === 'ParentFrame') as FrameState;
    const childRect = frameElement.elements.find((e) => e.options.name === 'ChildRect')!;
    const sibling = root.elements.find((e) => e.options.name === 'Sibling')!;

    const connection = {
      path: ConnectionPath.Straight,
      source: { x: 0, y: 0 },
      target: { x: 1, y: 1 },
      targetName: childRect.options.name,
    };
    sibling.options.connections = [connection];
    mockScene.connections.updateState();

    expect(mockScene.connections.state).toHaveLength(1);

    root.doAction(LayerActionID.Delete, frameElement);

    expect(sibling.options.connections).toEqual([]);
    expect(root.getSaveModel().elements?.[0].connections).toEqual([]);
  });

  it('points byName at framed copies after frameSelection', () => {
    const sibling = root.elements.find((e) => e.options.name === 'Sibling')!;
    mockScene.selection = {
      pipe: jest.fn().mockReturnValue({
        subscribe: (callback: (selected: ElementState[]) => void) => callback([sibling]),
      }),
    };
    mockScene.getNextElementName = jest.fn().mockReturnValue('New Frame');

    setRect(root, rect(0, 0, 300, 300));
    setRect(sibling, rect(100, 0, 50, 50));

    frameSelection(mockScene);

    const newFrame = root.elements.find(
      (e) => e.options.type === 'frame' && e.options.name !== 'ParentFrame'
    ) as FrameState;
    const framedCopy = newFrame.elements[0];

    expect(root.elements).not.toContain(sibling);
    expect(framedCopy).not.toBe(sibling);
    expect(framedCopy.parent).toBe(newFrame);
    expect(mockScene.byName.get('Sibling')).toBe(framedCopy);
  });

  (global.gc ? it : it.skip)('allows deleted frame descendants and DOM nodes to be collected', async () => {
    function deleteSubtree() {
      root.reinitializeMoveable = jest.fn();

      let frameElement = root.elements.find((e) => e.options.name === 'ParentFrame') as FrameState | undefined;
      if (!frameElement) {
        throw new Error('Expected parent frame');
      }

      let childRect = frameElement.elements.find((e) => e.options.name === 'ChildRect');
      let childText = frameElement.elements.find((e) => e.options.name === 'ChildText');

      if (!childRect || !childText) {
        throw new Error('Expected frame children');
      }

      setRect(frameElement, rect(0, 0, 100, 100));
      setRect(childRect, rect(0, 0, 50, 50));
      setRect(childText, rect(0, 60, 50, 20));

      const refs = {
        childRect: new WeakRef(childRect),
        childText: new WeakRef(childText),
        frameDiv: new WeakRef(frameElement.div!),
        childRectDiv: new WeakRef(childRect.div!),
        childTextDiv: new WeakRef(childText.div!),
      };

      root.doAction(LayerActionID.Delete, frameElement);

      frameElement = undefined;
      childRect = undefined;
      childText = undefined;

      return refs;
    }

    const refs = deleteSubtree();

    expect(mockScene.byName.size).toBe(1);
    expect(root.elements.map((element) => element.options.name)).toEqual(['Sibling']);
    expect(root.getSaveModel().elements?.map((element) => element.name)).toEqual(['Sibling']);

    await new Promise((resolve) => setTimeout(resolve, 0));
    await forceCollection(refs);
  });
});
