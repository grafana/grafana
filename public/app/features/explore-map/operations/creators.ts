/**
 * Operation creator functions
 *
 * Helper functions to create well-formed CRDT operations.
 * These are used by the Redux layer to convert user actions into operations.
 */

import { v4 as uuidv4 } from 'uuid';

import { HLCTimestamp } from '../crdt/hlc';
import {
  CRDTOperation,
  AddPanelOperation,
  RemovePanelOperation,
  UpdatePanelPositionOperation,
  UpdatePanelSizeOperation,
  UpdatePanelZIndexOperation,
  UpdatePanelExploreStateOperation,
  UpdateTitleOperation,
  AddCommentOperation,
  RemoveCommentOperation,
  BatchOperation,
  CommentData,
} from '../crdt/types';
import { SerializedExploreState } from '../state/types';

/**
 * Create an add panel operation
 */
export function createAddPanelOperation(
  mapUid: string,
  nodeId: string,
  timestamp: HLCTimestamp,
  payload: {
    panelId: string;
    exploreId: string;
    position: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }
): AddPanelOperation {
  return {
    type: 'add-panel',
    mapUid,
    operationId: uuidv4(),
    timestamp,
    nodeId,
    payload,
  };
}

/**
 * Create a remove panel operation
 */
export function createRemovePanelOperation(
  mapUid: string,
  nodeId: string,
  timestamp: HLCTimestamp,
  payload: {
    panelId: string;
    observedTags: string[];
  }
): RemovePanelOperation {
  return {
    type: 'remove-panel',
    mapUid,
    operationId: uuidv4(),
    timestamp,
    nodeId,
    payload,
  };
}

/**
 * Create an update panel position operation
 */
export function createUpdatePanelPositionOperation(
  mapUid: string,
  nodeId: string,
  timestamp: HLCTimestamp,
  payload: {
    panelId: string;
    x: number;
    y: number;
  }
): UpdatePanelPositionOperation {
  return {
    type: 'update-panel-position',
    mapUid,
    operationId: uuidv4(),
    timestamp,
    nodeId,
    payload,
  };
}

/**
 * Create an update panel size operation
 */
export function createUpdatePanelSizeOperation(
  mapUid: string,
  nodeId: string,
  timestamp: HLCTimestamp,
  payload: {
    panelId: string;
    width: number;
    height: number;
  }
): UpdatePanelSizeOperation {
  return {
    type: 'update-panel-size',
    mapUid,
    operationId: uuidv4(),
    timestamp,
    nodeId,
    payload,
  };
}

/**
 * Create an update panel z-index operation
 */
export function createUpdatePanelZIndexOperation(
  mapUid: string,
  nodeId: string,
  timestamp: HLCTimestamp,
  payload: {
    panelId: string;
    zIndex: number;
  }
): UpdatePanelZIndexOperation {
  return {
    type: 'update-panel-zindex',
    mapUid,
    operationId: uuidv4(),
    timestamp,
    nodeId,
    payload,
  };
}

/**
 * Create an update panel explore state operation
 */
export function createUpdatePanelExploreStateOperation(
  mapUid: string,
  nodeId: string,
  timestamp: HLCTimestamp,
  payload: {
    panelId: string;
    exploreState: SerializedExploreState | undefined;
  }
): UpdatePanelExploreStateOperation {
  return {
    type: 'update-panel-explore-state',
    mapUid,
    operationId: uuidv4(),
    timestamp,
    nodeId,
    payload,
  };
}

/**
 * Create an update title operation
 */
export function createUpdateTitleOperation(
  mapUid: string,
  nodeId: string,
  timestamp: HLCTimestamp,
  payload: {
    title: string;
  }
): UpdateTitleOperation {
  return {
    type: 'update-title',
    mapUid,
    operationId: uuidv4(),
    timestamp,
    nodeId,
    payload,
  };
}

/**
 * Create an add comment operation
 */
export function createAddCommentOperation(
  mapUid: string,
  nodeId: string,
  timestamp: HLCTimestamp,
  payload: {
    commentId: string;
    comment: CommentData;
  }
): AddCommentOperation {
  return {
    type: 'add-comment',
    mapUid,
    operationId: uuidv4(),
    timestamp,
    nodeId,
    payload,
  };
}

/**
 * Create a remove comment operation
 */
export function createRemoveCommentOperation(
  mapUid: string,
  nodeId: string,
  timestamp: HLCTimestamp,
  payload: {
    commentId: string;
    observedTags: string[];
  }
): RemoveCommentOperation {
  return {
    type: 'remove-comment',
    mapUid,
    operationId: uuidv4(),
    timestamp,
    nodeId,
    payload,
  };
}

/**
 * Create a batch operation containing multiple sub-operations
 */
export function createBatchOperation(
  mapUid: string,
  nodeId: string,
  timestamp: HLCTimestamp,
  operations: CRDTOperation[]
): BatchOperation {
  return {
    type: 'batch',
    mapUid,
    operationId: uuidv4(),
    timestamp,
    nodeId,
    payload: {
      operations,
    },
  };
}

/**
 * Create an operation to move multiple panels together
 * Returns a batch operation with position updates for all panels
 */
export function createMultiPanelMoveOperation(
  mapUid: string,
  nodeId: string,
  timestamp: HLCTimestamp,
  panelMoves: Array<{ panelId: string; x: number; y: number }>
): BatchOperation {
  const operations = panelMoves.map((move) =>
    createUpdatePanelPositionOperation(mapUid, nodeId, timestamp, move)
  );

  return createBatchOperation(mapUid, nodeId, timestamp, operations);
}

/**
 * Create an operation to duplicate a panel
 * Returns a batch operation that adds a new panel with the same properties
 */
export function createDuplicatePanelOperation(
  mapUid: string,
  nodeId: string,
  timestamp: HLCTimestamp,
  sourcePanel: {
    id: string;
    exploreId: string;
    position: { x: number; y: number; width: number; height: number };
    exploreState?: SerializedExploreState;
  },
  offset: { x: number; y: number }
): BatchOperation {
  const newPanelId = uuidv4();
  const newExploreId = `explore-${uuidv4()}`;

  const operations: CRDTOperation[] = [
    createAddPanelOperation(mapUid, nodeId, timestamp, {
      panelId: newPanelId,
      exploreId: newExploreId,
      position: {
        x: sourcePanel.position.x + offset.x,
        y: sourcePanel.position.y + offset.y,
        width: sourcePanel.position.width,
        height: sourcePanel.position.height,
      },
    }),
  ];

  // If source panel has explore state, copy it
  if (sourcePanel.exploreState) {
    operations.push(
      createUpdatePanelExploreStateOperation(mapUid, nodeId, timestamp, {
        panelId: newPanelId,
        exploreState: sourcePanel.exploreState,
      })
    );
  }

  return createBatchOperation(mapUid, nodeId, timestamp, operations);
}
