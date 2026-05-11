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

import { ElementState } from './element';
import { FrameState } from './frame';
import { RootElement } from './root';
import { LayerActionID } from '../../../plugins/panel/canvas/types';

describe('Scene.byName', () => {
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
        updateState: jest.fn(),
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
      panel: {},
      subscription: { unsubscribe: jest.fn() },
      revId: 0,
      scale: 1,
      style: {},
    };

    root = new RootElement(
      {
        type: 'frame',
        elements: [
          {
            type: 'frame',
            name: 'ParentFrame',
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
  });

  it('accumulates orphaned child element entries when a parent frame is deleted', () => {
    expect(mockScene.byName.size).toBe(4);
    expect(mockScene.byName.has('ParentFrame')).toBe(true);
    expect(mockScene.byName.has('ChildRect')).toBe(true);
    expect(mockScene.byName.has('ChildText')).toBe(true);
    expect(mockScene.byName.has('Sibling')).toBe(true);

    const frameElement = root.elements.find((e) => e.options.name === 'ParentFrame')!;
    root.doAction(LayerActionID.Delete, frameElement);

    expect(mockScene.byName.has('ParentFrame')).toBe(false);

    // THE LEAK: children remain in byName after parent frame deletion
    // This assertion FAILS with current code - demonstrating the leak
    expect(mockScene.byName.has('ChildRect')).toBe(false);
    expect(mockScene.byName.has('ChildText')).toBe(false);

    // Sibling remains
    expect(mockScene.byName.has('Sibling')).toBe(true);

    // byName should have only 1 entry (sibling) - currently leaks to 3
    expect(mockScene.byName.size).toBe(1);
  });
});
