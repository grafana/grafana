import { ConnectionPath, type CanvasConnection } from 'app/features/canvas/element';
import type { ElementState } from 'app/features/canvas/runtime/element';
import type { Scene } from 'app/features/canvas/runtime/scene';

import { Connections2 } from './Connections2';

// Mock the utils module — real implementations except coords helpers used by Connections2
jest.mock('../../utils', () => {
  const originalModule = jest.requireActual('../../utils');
  return {
    ...originalModule,
    calculateCoordinates2: jest.fn((source, target, info) => ({
      x1: 100,
      y1: 100,
      x2: 200,
      y2: 200,
    })),
    getParentBoundingClientRect: jest.fn(() => ({
      left: 0,
      top: 0,
      width: 1000,
      height: 1000,
      right: 1000,
      bottom: 1000,
      x: 0,
      y: 0,
      toJSON: () => {},
    })),
  };
});

const { calculateCoordinates2 } = jest.requireMock('../../utils');

// Helper to create a proper CanvasConnection with all required fields
const createConnection = (overrides?: Partial<CanvasConnection>): CanvasConnection => ({
  source: { x: 0, y: 0 },
  target: { x: 0, y: 0 },
  path: ConnectionPath.Straight,
  targetName: 'target',
  ...overrides,
});

// Helper to create a mock element
const createMockElement = (name: string, connections?: CanvasConnection[]): ElementState => {
  const mockDiv = document.createElement('div');
  mockDiv.getBoundingClientRect = jest.fn(() => ({
    left: 100,
    top: 100,
    width: 50,
    height: 50,
    right: 150,
    bottom: 150,
    x: 100,
    y: 100,
    toJSON: () => {},
  }));

  const mockParent = document.createElement('div');
  Object.defineProperty(mockDiv, 'parentElement', {
    value: mockParent,
    writable: true,
  });

  return {
    getName: jest.fn(() => name),
    div: mockDiv,
    options: {
      name,
      type: 'test-element',
      connections: connections || [],
    },
  } as unknown as ElementState;
};

// Helper to create a mock scene
const createMockScene = (): Scene =>
  ({
    byName: new Map(),
    scale: 1,
    connections: {
      updateState: jest.fn(),
    } as unknown as Scene['connections'],
    moved: {
      next: jest.fn(),
    } as unknown as Scene['moved'],
  }) as unknown as Scene;

describe('Connections2', () => {
  describe('updateConnectionsAfterIndividualMove - integration', () => {
    it('should call calculateCoordinates2 with correct parameters', () => {
      const mockScene = createMockScene();
      const connectionsObj = new Connections2(mockScene);

      const sourceElement = createMockElement('source', [
        createConnection({
          sourceOriginal: { x: 50, y: 50 },
          targetOriginal: { x: 150, y: 150 },
        }),
      ]);
      const targetElement = createMockElement('target');

      connectionsObj.state = [
        {
          source: sourceElement,
          target: targetElement,
          info: createConnection(),
          index: 0,
          sourceOriginal: { x: 50, y: 50 },
          targetOriginal: { x: 150, y: 150 },
        },
      ];

      calculateCoordinates2.mockClear();
      connectionsObj.updateConnectionsAfterIndividualMove(sourceElement);

      expect(calculateCoordinates2).toHaveBeenCalledWith(sourceElement, targetElement, connectionsObj.state[0].info);
    });

    it('should update coordinates through shared utility', () => {
      const mockScene = createMockScene();
      const connectionsObj = new Connections2(mockScene);

      const sourceElement = createMockElement('source', [
        createConnection({
          sourceOriginal: { x: 50, y: 50 },
          targetOriginal: { x: 150, y: 150 },
        }),
      ]);
      const targetElement = createMockElement('target');

      connectionsObj.state = [
        {
          source: sourceElement,
          target: targetElement,
          info: createConnection(),
          index: 0,
          sourceOriginal: { x: 50, y: 50 },
          targetOriginal: { x: 150, y: 150 },
        },
      ];

      connectionsObj.updateConnectionsAfterIndividualMove(sourceElement);

      // Verify coordinates were updated by the shared utility
      expect(sourceElement.options?.connections?.[0].sourceOriginal).toEqual({ x: 100, y: 100 });
    });
  });

  describe('updateConnectionsAfterGroupMove - integration', () => {
    it('should call calculateCoordinates2 when both elements are selected', () => {
      const mockScene = createMockScene();
      const connectionsObj = new Connections2(mockScene);

      const sourceElement = createMockElement('source', [
        createConnection({
          sourceOriginal: { x: 50, y: 50 },
          targetOriginal: { x: 150, y: 150 },
        }),
      ]);
      const targetElement = createMockElement('target');

      connectionsObj.state = [
        {
          source: sourceElement,
          target: targetElement,
          info: createConnection(),
          index: 0,
          sourceOriginal: { x: 50, y: 50 },
          targetOriginal: { x: 150, y: 150 },
        },
      ];

      const selectedTargets = [sourceElement.div!, targetElement.div!];
      const movedElements = [sourceElement, targetElement];

      calculateCoordinates2.mockClear();
      connectionsObj.updateConnectionsAfterGroupMove(movedElements, selectedTargets);

      expect(calculateCoordinates2).toHaveBeenCalledWith(sourceElement, targetElement, connectionsObj.state[0].info);
    });

    it('should update both coordinates through shared utility', () => {
      const mockScene = createMockScene();
      const connectionsObj = new Connections2(mockScene);

      const sourceElement = createMockElement('source', [
        createConnection({
          sourceOriginal: { x: 50, y: 50 },
          targetOriginal: { x: 150, y: 150 },
        }),
      ]);
      const targetElement = createMockElement('target');

      connectionsObj.state = [
        {
          source: sourceElement,
          target: targetElement,
          info: createConnection(),
          index: 0,
          sourceOriginal: { x: 50, y: 50 },
          targetOriginal: { x: 150, y: 150 },
        },
      ];

      const selectedTargets = [sourceElement.div!, targetElement.div!];
      const movedElements = [sourceElement, targetElement];

      connectionsObj.updateConnectionsAfterGroupMove(movedElements, selectedTargets);

      // Verify both coordinates were updated by the shared utility
      expect(sourceElement.options?.connections?.[0].sourceOriginal).toEqual({ x: 100, y: 100 });
      expect(sourceElement.options?.connections?.[0].targetOriginal).toEqual({ x: 200, y: 200 });
    });
  });
});
