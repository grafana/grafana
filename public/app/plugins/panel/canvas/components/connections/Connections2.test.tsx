import { CanvasConnection, ConnectionPath } from 'app/features/canvas/element';
import { ElementState } from 'app/features/canvas/runtime/element';
import { Scene } from 'app/features/canvas/runtime/scene';

import { Connections2 } from './Connections2';

// Mock the utils module
jest.mock('../../utils', () => ({
  calculateAngle: jest.fn(),
  calculateCoordinates2: jest.fn((source, target, info) => ({
    x1: 100,
    y1: 100,
    x2: 200,
    y2: 200,
  })),
  getConnections: jest.fn(() => []),
  getElementTransformAndDimensions: jest.fn(),
  getNormalizedRotatedOffset: jest.fn(),
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
  isConnectionSource: jest.fn(),
  isConnectionTarget: jest.fn(),
}));

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
const createMockElement = (name: string, connections?: CanvasConnection[]): Partial<ElementState> => {
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
  };
};

// Helper to create a mock scene
const createMockScene = (): Partial<Scene> => ({
  byName: new Map(),
  scale: 1,
  connections: {
    updateState: jest.fn(),
  } as unknown as Scene['connections'],
  moved: {
    next: jest.fn(),
  } as unknown as Scene['moved'],
});

describe('Connections2', () => {
  describe('updateConnectionsAfterIndividualMove - integration', () => {
    it('should call calculateCoordinates2 with correct parameters', () => {
      const mockScene = createMockScene() as Scene;
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
          source: sourceElement as ElementState,
          target: targetElement as ElementState,
          info: createConnection(),
          index: 0,
          sourceOriginal: { x: 50, y: 50 },
          targetOriginal: { x: 150, y: 150 },
        },
      ];

      calculateCoordinates2.mockClear();
      connectionsObj.updateConnectionsAfterIndividualMove(sourceElement as ElementState);

      // Verify calculateCoordinates2 was called
      expect(calculateCoordinates2).toHaveBeenCalled();
      
      // Verify it was called with the expected parameters (source, target, info)
      const call = calculateCoordinates2.mock.calls[0];
      expect(call[0]).toBe(sourceElement); // source parameter
      expect(call[1]).toBe(targetElement); // target parameter
      expect(call[2]).toBe(connectionsObj.state[0].info); // info parameter
    });

    it('should update coordinates through shared utility', () => {
      const mockScene = createMockScene() as Scene;
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
          source: sourceElement as ElementState,
          target: targetElement as ElementState,
          info: createConnection(),
          index: 0,
          sourceOriginal: { x: 50, y: 50 },
          targetOriginal: { x: 150, y: 150 },
        },
      ];

      connectionsObj.updateConnectionsAfterIndividualMove(sourceElement as ElementState);

      // Verify coordinates were updated by the shared utility
      expect(sourceElement.options?.connections?.[0].sourceOriginal).toEqual({ x: 100, y: 100 });
    });
  });

  describe('updateConnectionsAfterGroupMove - integration', () => {
    it('should call calculateCoordinates2 when both elements are selected', () => {
      const mockScene = createMockScene() as Scene;
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
          source: sourceElement as ElementState,
          target: targetElement as ElementState,
          info: createConnection(),
          index: 0,
          sourceOriginal: { x: 50, y: 50 },
          targetOriginal: { x: 150, y: 150 },
        },
      ];

      const selectedTargets = [sourceElement.div!, targetElement.div!];
      const movedElements = [sourceElement as ElementState, targetElement as ElementState];

      calculateCoordinates2.mockClear();
      connectionsObj.updateConnectionsAfterGroupMove(movedElements, selectedTargets);

      // Verify calculateCoordinates2 was called
      expect(calculateCoordinates2).toHaveBeenCalled();
    });

    it('should update both coordinates through shared utility', () => {
      const mockScene = createMockScene() as Scene;
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
          source: sourceElement as ElementState,
          target: targetElement as ElementState,
          info: createConnection(),
          index: 0,
          sourceOriginal: { x: 50, y: 50 },
          targetOriginal: { x: 150, y: 150 },
        },
      ];

      const selectedTargets = [sourceElement.div!, targetElement.div!];
      const movedElements = [sourceElement as ElementState, targetElement as ElementState];

      connectionsObj.updateConnectionsAfterGroupMove(movedElements, selectedTargets);

      // Verify both coordinates were updated by the shared utility
      expect(sourceElement.options?.connections?.[0].sourceOriginal).toEqual({ x: 100, y: 100 });
      expect(sourceElement.options?.connections?.[0].targetOriginal).toEqual({ x: 200, y: 200 });
    });
  });
});
