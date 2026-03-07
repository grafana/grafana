import { CanvasConnection, ConnectionPath } from 'app/features/canvas/element';
import { ElementState } from 'app/features/canvas/runtime/element';

import { ConnectionState } from '../../types';

import {
  updateConnectionsAfterIndividualMove,
  updateConnectionsAfterGroupMove,
  CoordinateCalculator,
} from './connectionMovementUtils';

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

// Mock coordinate calculator that returns predictable values
const mockCalculateCoords: CoordinateCalculator = () => ({
  x1: 100,
  y1: 100,
  x2: 200,
  y2: 200,
});

describe('connectionMovementUtils', () => {
  describe('updateConnectionsAfterIndividualMove', () => {
    it('should update source coordinates when source element is moved', () => {
      const sourceElement = createMockElement('source', [
        createConnection({
          sourceOriginal: { x: 50, y: 50 },
          targetOriginal: { x: 150, y: 150 },
        }),
      ]);
      const targetElement = createMockElement('target');

      const connectionStates: ConnectionState[] = [
        {
          source: sourceElement as ElementState,
          target: targetElement as ElementState,
          info: createConnection(),
          index: 0,
          sourceOriginal: { x: 50, y: 50 },
          targetOriginal: { x: 150, y: 150 },
        },
      ];

      updateConnectionsAfterIndividualMove(
        sourceElement as ElementState,
        connectionStates,
        mockCalculateCoords
      );

      // Verify sourceOriginal was updated
      expect(sourceElement.options?.connections?.[0].sourceOriginal).toEqual({ x: 100, y: 100 });
      // Verify targetOriginal was NOT updated
      expect(sourceElement.options?.connections?.[0].targetOriginal).toEqual({ x: 150, y: 150 });
    });

    it('should update target coordinates when target element is moved', () => {
      const sourceElement = createMockElement('source', [
        createConnection({
          sourceOriginal: { x: 50, y: 50 },
          targetOriginal: { x: 150, y: 150 },
        }),
      ]);
      const targetElement = createMockElement('target');

      const connectionStates: ConnectionState[] = [
        {
          source: sourceElement as ElementState,
          target: targetElement as ElementState,
          info: createConnection(),
          index: 0,
          sourceOriginal: { x: 50, y: 50 },
          targetOriginal: { x: 150, y: 150 },
        },
      ];

      updateConnectionsAfterIndividualMove(
        targetElement as ElementState,
        connectionStates,
        mockCalculateCoords
      );

      // Verify sourceOriginal was NOT updated
      expect(sourceElement.options?.connections?.[0].sourceOriginal).toEqual({ x: 50, y: 50 });
      // Verify targetOriginal was updated
      expect(sourceElement.options?.connections?.[0].targetOriginal).toEqual({ x: 200, y: 200 });
    });

    it('should recalculate vertices when element is moved', () => {
      const sourceElement = createMockElement('source', [
        createConnection({
          sourceOriginal: { x: 100, y: 100 },
          targetOriginal: { x: 150, y: 150 },
          vertices: [{ x: 0.5, y: 0.5 }],
        }),
      ]);
      const targetElement = createMockElement('target');

      const connectionStates: ConnectionState[] = [
        {
          source: sourceElement as ElementState,
          target: targetElement as ElementState,
          info: createConnection(),
          index: 0,
          sourceOriginal: { x: 100, y: 100 },
          targetOriginal: { x: 150, y: 150 },
        },
      ];

      updateConnectionsAfterIndividualMove(
        targetElement as ElementState,
        connectionStates,
        mockCalculateCoords
      );

      // Verify vertex was recalculated
      const vertex = sourceElement.options?.connections?.[0].vertices?.[0];
      expect(vertex).toBeDefined();
      expect(vertex?.x).toBeCloseTo(0.25, 5);
      expect(vertex?.y).toBeCloseTo(0.25, 5);
    });

    it('should handle connections without vertices', () => {
      const sourceElement = createMockElement('source', [
        createConnection({
          sourceOriginal: { x: 50, y: 50 },
          targetOriginal: { x: 150, y: 150 },
        }),
      ]);
      const targetElement = createMockElement('target');

      const connectionStates: ConnectionState[] = [
        {
          source: sourceElement as ElementState,
          target: targetElement as ElementState,
          info: createConnection(),
          index: 0,
          sourceOriginal: { x: 50, y: 50 },
          targetOriginal: { x: 150, y: 150 },
        },
      ];

      expect(() => {
        updateConnectionsAfterIndividualMove(
          sourceElement as ElementState,
          connectionStates,
          mockCalculateCoords
        );
      }).not.toThrow();

      expect(sourceElement.options?.connections?.[0].sourceOriginal).toEqual({ x: 100, y: 100 });
    });

    it('should handle division by zero in vertex calculation', () => {
      const sourceElement = createMockElement('source', [
        createConnection({
          sourceOriginal: { x: 100, y: 100 },
          targetOriginal: { x: 100, y: 100 },
          vertices: [{ x: 0.5, y: 0.5 }],
        }),
      ]);
      const targetElement = createMockElement('target');

      const connectionStates: ConnectionState[] = [
        {
          source: sourceElement as ElementState,
          target: targetElement as ElementState,
          info: createConnection(),
          index: 0,
          sourceOriginal: { x: 100, y: 100 },
          targetOriginal: { x: 100, y: 100 },
        },
      ];

      expect(() => {
        updateConnectionsAfterIndividualMove(
          sourceElement as ElementState,
          connectionStates,
          mockCalculateCoords
        );
      }).not.toThrow();
    });

    it('should skip connections where moved element is neither source nor target', () => {
      const sourceElement = createMockElement('source', [
        createConnection({
          sourceOriginal: { x: 50, y: 50 },
          targetOriginal: { x: 150, y: 150 },
        }),
      ]);
      const targetElement = createMockElement('target');
      const otherElement = createMockElement('other');

      const connectionStates: ConnectionState[] = [
        {
          source: sourceElement as ElementState,
          target: targetElement as ElementState,
          info: createConnection(),
          index: 0,
          sourceOriginal: { x: 50, y: 50 },
          targetOriginal: { x: 150, y: 150 },
        },
      ];

      updateConnectionsAfterIndividualMove(
        otherElement as ElementState,
        connectionStates,
        mockCalculateCoords
      );

      // Coordinates should remain unchanged
      expect(sourceElement.options?.connections?.[0].sourceOriginal).toEqual({ x: 50, y: 50 });
      expect(sourceElement.options?.connections?.[0].targetOriginal).toEqual({ x: 150, y: 150 });
    });
  });

  describe('updateConnectionsAfterGroupMove', () => {
    it('should update both coordinates when both source and target are selected', () => {
      const sourceElement = createMockElement('source', [
        createConnection({
          sourceOriginal: { x: 50, y: 50 },
          targetOriginal: { x: 150, y: 150 },
        }),
      ]);
      const targetElement = createMockElement('target');

      const connectionStates: ConnectionState[] = [
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

      updateConnectionsAfterGroupMove(
        movedElements,
        selectedTargets,
        connectionStates,
        mockCalculateCoords
      );

      // Both should be updated
      expect(sourceElement.options?.connections?.[0].sourceOriginal).toEqual({ x: 100, y: 100 });
      expect(sourceElement.options?.connections?.[0].targetOriginal).toEqual({ x: 200, y: 200 });
    });

    it('should not update when only source is selected', () => {
      const sourceElement = createMockElement('source', [
        createConnection({
          sourceOriginal: { x: 50, y: 50 },
          targetOriginal: { x: 150, y: 150 },
        }),
      ]);
      const targetElement = createMockElement('target');

      const connectionStates: ConnectionState[] = [
        {
          source: sourceElement as ElementState,
          target: targetElement as ElementState,
          info: createConnection(),
          index: 0,
          sourceOriginal: { x: 50, y: 50 },
          targetOriginal: { x: 150, y: 150 },
        },
      ];

      const selectedTargets = [sourceElement.div!];
      const movedElements = [sourceElement as ElementState];

      updateConnectionsAfterGroupMove(
        movedElements,
        selectedTargets,
        connectionStates,
        mockCalculateCoords
      );

      // Coordinates should remain unchanged
      expect(sourceElement.options?.connections?.[0].sourceOriginal).toEqual({ x: 50, y: 50 });
      expect(sourceElement.options?.connections?.[0].targetOriginal).toEqual({ x: 150, y: 150 });
    });

    it('should not update when only target is selected', () => {
      const sourceElement = createMockElement('source', [
        createConnection({
          sourceOriginal: { x: 50, y: 50 },
          targetOriginal: { x: 150, y: 150 },
        }),
      ]);
      const targetElement = createMockElement('target');

      const connectionStates: ConnectionState[] = [
        {
          source: sourceElement as ElementState,
          target: targetElement as ElementState,
          info: createConnection(),
          index: 0,
          sourceOriginal: { x: 50, y: 50 },
          targetOriginal: { x: 150, y: 150 },
        },
      ];

      const selectedTargets = [targetElement.div!];
      const movedElements = [targetElement as ElementState];

      updateConnectionsAfterGroupMove(
        movedElements,
        selectedTargets,
        connectionStates,
        mockCalculateCoords
      );

      // Coordinates should remain unchanged
      expect(sourceElement.options?.connections?.[0].sourceOriginal).toEqual({ x: 50, y: 50 });
      expect(sourceElement.options?.connections?.[0].targetOriginal).toEqual({ x: 150, y: 150 });
    });

    it('should skip update when connection itself is selected', () => {
      const sourceElement = createMockElement('source', [
        createConnection({
          sourceOriginal: { x: 50, y: 50 },
          targetOriginal: { x: 150, y: 150 },
        }),
      ]);
      const targetElement = createMockElement('target');

      const connectionStates: ConnectionState[] = [
        {
          source: sourceElement as ElementState,
          target: targetElement as ElementState,
          info: createConnection(),
          index: 0,
          sourceOriginal: { x: 50, y: 50 },
          targetOriginal: { x: 150, y: 150 },
        },
      ];

      // Create mock SVG element representing the connection
      const mockConnectionSVG = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      mockConnectionSVG.setAttribute('data-connection-index', '0');
      mockConnectionSVG.setAttribute('data-connection-source', 'source');

      const selectedTargets = [sourceElement.div!, targetElement.div!, mockConnectionSVG];
      const movedElements = [sourceElement as ElementState, targetElement as ElementState];

      updateConnectionsAfterGroupMove(
        movedElements,
        selectedTargets,
        connectionStates,
        mockCalculateCoords
      );

      // Coordinates should remain unchanged
      expect(sourceElement.options?.connections?.[0].sourceOriginal).toEqual({ x: 50, y: 50 });
      expect(sourceElement.options?.connections?.[0].targetOriginal).toEqual({ x: 150, y: 150 });
    });

    it('should handle multiple connections with selective updates', () => {
      const element1 = createMockElement('element1', [
        createConnection({
          targetName: 'element2',
          sourceOriginal: { x: 10, y: 10 },
          targetOriginal: { x: 20, y: 20 },
        }),
        createConnection({
          targetName: 'element3',
          sourceOriginal: { x: 30, y: 30 },
          targetOriginal: { x: 40, y: 40 },
        }),
      ]);
      const element2 = createMockElement('element2');
      const element3 = createMockElement('element3');

      const connectionStates: ConnectionState[] = [
        {
          source: element1 as ElementState,
          target: element2 as ElementState,
          info: createConnection({ targetName: 'element2' }),
          index: 0,
          sourceOriginal: { x: 10, y: 10 },
          targetOriginal: { x: 20, y: 20 },
        },
        {
          source: element1 as ElementState,
          target: element3 as ElementState,
          info: createConnection({ targetName: 'element3' }),
          index: 1,
          sourceOriginal: { x: 30, y: 30 },
          targetOriginal: { x: 40, y: 40 },
        },
      ];

      // Select element1 and element2 (not element3)
      const selectedTargets = [element1.div!, element2.div!];
      const movedElements = [element1 as ElementState, element2 as ElementState];

      updateConnectionsAfterGroupMove(
        movedElements,
        selectedTargets,
        connectionStates,
        mockCalculateCoords
      );

      // First connection should be updated
      expect(element1.options?.connections?.[0].sourceOriginal).toEqual({ x: 100, y: 100 });
      expect(element1.options?.connections?.[0].targetOriginal).toEqual({ x: 200, y: 200 });

      // Second connection should remain unchanged
      expect(element1.options?.connections?.[1].sourceOriginal).toEqual({ x: 30, y: 30 });
      expect(element1.options?.connections?.[1].targetOriginal).toEqual({ x: 40, y: 40 });
    });

    it('should handle empty selection', () => {
      const sourceElement = createMockElement('source', [
        createConnection({
          sourceOriginal: { x: 50, y: 50 },
          targetOriginal: { x: 150, y: 150 },
        }),
      ]);
      const targetElement = createMockElement('target');

      const connectionStates: ConnectionState[] = [
        {
          source: sourceElement as ElementState,
          target: targetElement as ElementState,
          info: createConnection(),
          index: 0,
          sourceOriginal: { x: 50, y: 50 },
          targetOriginal: { x: 150, y: 150 },
        },
      ];

      updateConnectionsAfterGroupMove([], [], connectionStates, mockCalculateCoords);

      // Coordinates should remain unchanged
      expect(sourceElement.options?.connections?.[0].sourceOriginal).toEqual({ x: 50, y: 50 });
      expect(sourceElement.options?.connections?.[0].targetOriginal).toEqual({ x: 150, y: 150 });
    });
  });
});
