import { ElementState } from 'app/features/canvas/runtime/element';

import { ConnectionState } from '../../types';

/**
 * Type for coordinate calculation functions used by Connections and Connections2
 */
export type CoordinateCalculator = (
  source: ElementState,
  target: ElementState,
  connectionState: ConnectionState
) => { x1: number; y1: number; x2: number; y2: number };

/**
 * Update connection coordinates when an individual element is moved.
 * This function handles updating either the source or target coordinates and
 * recalculates vertex positions to maintain the visual shape of the connection.
 *
 * @param movedElement - The element that was moved
 * @param connectionStates - Array of all connection states to check
 * @param calculateCoords - Function to calculate coordinates (specific to Connections or Connections2)
 */
export function updateConnectionsAfterIndividualMove(
  movedElement: ElementState,
  connectionStates: ConnectionState[],
  calculateCoords: CoordinateCalculator
): void {
  // Find connections where this element is the source or target
  connectionStates.forEach((connectionState) => {
    const isSource = connectionState.source.getName() === movedElement.getName();
    const isTarget = connectionState.target.getName() === movedElement.getName();

    if (isSource || isTarget) {
      // Get current positions of source and target
      const { x1, y1, x2, y2 } = calculateCoords(connectionState.source, connectionState.target, connectionState);

      // Store old original coordinates for vertex recalculation
      const oldSourceOriginal = connectionState.sourceOriginal
        ? { ...connectionState.sourceOriginal }
        : { x: x1, y: y1 };
      const oldTargetOriginal = connectionState.targetOriginal
        ? { ...connectionState.targetOriginal }
        : { x: x2, y: y2 };

      // Connections are stored on the source element, not the moved element
      const sourceElement = connectionState.source;
      if (sourceElement.options.connections && connectionState.index >= 0) {
        const connection = sourceElement.options.connections[connectionState.index];

        // Update only the coordinate for the moved element
        if (isSource) {
          connection.sourceOriginal = { x: x1, y: y1 };
        } else if (isTarget) {
          connection.targetOriginal = { x: x2, y: y2 };
        }

        // Recalculate vertex relative coordinates to maintain visual shape
        if (connection.vertices && connection.vertices.length > 0) {
          const newSourceOriginal = connection.sourceOriginal || { x: x1, y: y1 };
          const newTargetOriginal = connection.targetOriginal || { x: x2, y: y2 };

          const oldXDist = oldTargetOriginal.x - oldSourceOriginal.x;
          const oldYDist = oldTargetOriginal.y - oldSourceOriginal.y;
          const newXDist = newTargetOriginal.x - newSourceOriginal.x;
          const newYDist = newTargetOriginal.y - newSourceOriginal.y;

          // Avoid division by zero
          const safeNewXDist = newXDist === 0 ? 0.001 : newXDist;
          const safeNewYDist = newYDist === 0 ? 0.001 : newYDist;

          connection.vertices.forEach((vertex) => {
            // Convert from old relative coordinates to absolute positions
            const oldAbsX = vertex.x * oldXDist + oldSourceOriginal.x;
            const oldAbsY = vertex.y * oldYDist + oldSourceOriginal.y;

            // Convert back to new relative coordinates
            vertex.x = (oldAbsX - newSourceOriginal.x) / safeNewXDist;
            vertex.y = (oldAbsY - newSourceOriginal.y) / safeNewYDist;
          });
        }
      }
    }
  });
}

/**
 * Update connection coordinates based on what's selected in a group move.
 * When both source and target elements are selected together, both coordinates
 * are updated to maintain the connection's relative position.
 *
 * @param movedElements - Array of elements that were moved
 * @param selectedTargets - Array of selected HTML/SVG elements
 * @param connectionStates - Array of all connection states to check
 * @param calculateCoords - Function to calculate coordinates (specific to Connections or Connections2)
 */
export function updateConnectionsAfterGroupMove(
  movedElements: ElementState[],
  selectedTargets: Array<HTMLElement | SVGElement>,
  connectionStates: ConnectionState[],
  calculateCoords: CoordinateCalculator
): void {
  // Check each connection
  connectionStates.forEach((connectionState) => {
    const sourceDiv = connectionState.source.div;
    const targetDiv = connectionState.target.div;

    // Find if the connection itself is selected (by checking its transparent overlay)
    const connectionSelected = selectedTargets.some(
      (target) =>
        target instanceof SVGElement &&
        target.hasAttribute('data-connection-index') &&
        parseInt(target.getAttribute('data-connection-index') || '-1', 10) === connectionState.index &&
        target.getAttribute('data-connection-source') === connectionState.source.getName()
    );

    if (connectionSelected) {
      // Connection itself is selected - it will be moved by handleConnectionDrag, no need to do anything here
      return;
    }

    // Check if both source and target elements are selected
    if (sourceDiv && targetDiv && selectedTargets.includes(sourceDiv) && selectedTargets.includes(targetDiv)) {
      // Both source and target are selected - update both original coordinates to current positions
      const sourceElement = movedElements.find((el) => el.div === sourceDiv);
      const targetElement = movedElements.find((el) => el.div === targetDiv);

      if (sourceElement && targetElement) {
        // Get current positions of source and target
        const { x1, y1, x2, y2 } = calculateCoords(sourceElement, targetElement, connectionState);

        // Update both original coordinates to the new positions
        if (sourceElement.options.connections) {
          sourceElement.options.connections[connectionState.index].sourceOriginal = { x: x1, y: y1 };
          sourceElement.options.connections[connectionState.index].targetOriginal = { x: x2, y: y2 };
        }
      }
    }
    // If neither the connection nor both elements are selected, the connection stays frozen
  });
}
