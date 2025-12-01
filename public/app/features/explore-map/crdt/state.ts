/**
 * CRDT State Manager for Explore Map
 *
 * This class manages the CRDT-based state and provides high-level
 * operations for adding/removing/updating panels.
 */

import { v4 as uuidv4 } from 'uuid';
import { HybridLogicalClock } from './hlc';
import { LWWRegister, createLWWRegister } from './lwwregister';
import { ORSet } from './orset';
import { PNCounter } from './pncounter';
import {
  CRDTExploreMapState,
  CRDTPanelData,
  CRDTOperation,
  AddPanelOperation,
  RemovePanelOperation,
  UpdatePanelPositionOperation,
  UpdatePanelSizeOperation,
  UpdatePanelZIndexOperation,
  UpdatePanelExploreStateOperation,
  UpdateTitleOperation,
  OperationResult,
  CRDTExploreMapStateJSON,
} from './types';
import { SerializedExploreState } from '../state/types';

export class CRDTStateManager {
  private state: CRDTExploreMapState;
  private clock: HybridLogicalClock;
  private nodeId: string;
  private mapUid: string;

  constructor(mapUid: string, nodeId?: string) {
    this.mapUid = mapUid;
    this.nodeId = nodeId || uuidv4();
    this.clock = new HybridLogicalClock(this.nodeId);

    // Initialize empty state
    this.state = this.createInitialState();
  }

  private createInitialState(): CRDTExploreMapState {
    return {
      uid: this.mapUid,
      title: createLWWRegister('Untitled Map', this.nodeId),
      panels: new ORSet<string>(),
      panelData: new Map(),
      zIndexCounter: new PNCounter(),
      local: {
        viewport: {
          zoom: 1,
          panX: -4040,
          panY: -4460,
        },
        selectedPanelIds: [],
        cursors: {},
      },
    };
  }

  /**
   * Get the current node ID
   */
  getNodeId(): string {
    return this.nodeId;
  }

  /**
   * Get the current state
   */
  getState(): CRDTExploreMapState {
    return this.state;
  }

  /**
   * Get all panel IDs currently in the set
   */
  getPanelIds(): string[] {
    return this.state.panels.values();
  }

  /**
   * Get panel data by ID
   */
  getPanelData(panelId: string): CRDTPanelData | undefined {
    if (!this.state.panels.contains(panelId)) {
      return undefined;
    }
    return this.state.panelData.get(panelId);
  }

  /**
   * Get a plain object representation of a panel for UI rendering
   */
  getPanelForUI(panelId: string) {
    const data = this.getPanelData(panelId);
    if (!data) {
      return undefined;
    }

    return {
      id: data.id,
      exploreId: data.exploreId,
      position: {
        x: data.positionX.get(),
        y: data.positionY.get(),
        width: data.width.get(),
        height: data.height.get(),
        zIndex: data.zIndex.get(),
      },
      exploreState: data.exploreState.get(),
    };
  }

  /**
   * Get all panels for UI rendering
   */
  getAllPanelsForUI() {
    const panels: Record<string, any> = {};
    for (const panelId of this.getPanelIds()) {
      const panel = this.getPanelForUI(panelId);
      if (panel) {
        panels[panelId] = panel;
      }
    }
    return panels;
  }

  /**
   * Create an add panel operation
   */
  createAddPanelOperation(
    panelId: string,
    exploreId: string,
    position: { x: number; y: number; width: number; height: number }
  ): AddPanelOperation {
    const timestamp = this.clock.tick();
    return {
      type: 'add-panel',
      mapUid: this.mapUid,
      operationId: uuidv4(),
      timestamp,
      nodeId: this.nodeId,
      payload: {
        panelId,
        exploreId,
        position,
      },
    };
  }

  /**
   * Create a remove panel operation
   */
  createRemovePanelOperation(panelId: string): RemovePanelOperation | null {
    if (!this.state.panels.contains(panelId)) {
      return null;
    }

    const timestamp = this.clock.tick();
    const observedTags = this.state.panels.getTags(panelId);

    return {
      type: 'remove-panel',
      mapUid: this.mapUid,
      operationId: uuidv4(),
      timestamp,
      nodeId: this.nodeId,
      payload: {
        panelId,
        observedTags,
      },
    };
  }

  /**
   * Create an update panel position operation
   */
  createUpdatePanelPositionOperation(
    panelId: string,
    x: number,
    y: number
  ): UpdatePanelPositionOperation | null {
    if (!this.state.panels.contains(panelId)) {
      return null;
    }

    const timestamp = this.clock.tick();
    return {
      type: 'update-panel-position',
      mapUid: this.mapUid,
      operationId: uuidv4(),
      timestamp,
      nodeId: this.nodeId,
      payload: {
        panelId,
        x,
        y,
      },
    };
  }

  /**
   * Create an update panel size operation
   */
  createUpdatePanelSizeOperation(
    panelId: string,
    width: number,
    height: number
  ): UpdatePanelSizeOperation | null {
    if (!this.state.panels.contains(panelId)) {
      return null;
    }

    const timestamp = this.clock.tick();
    return {
      type: 'update-panel-size',
      mapUid: this.mapUid,
      operationId: uuidv4(),
      timestamp,
      nodeId: this.nodeId,
      payload: {
        panelId,
        width,
        height,
      },
    };
  }

  /**
   * Create an update panel z-index operation
   */
  createUpdatePanelZIndexOperation(panelId: string): UpdatePanelZIndexOperation | null {
    if (!this.state.panels.contains(panelId)) {
      return null;
    }

    const timestamp = this.clock.tick();
    const zIndex = this.state.zIndexCounter.next(this.nodeId);

    return {
      type: 'update-panel-zindex',
      mapUid: this.mapUid,
      operationId: uuidv4(),
      timestamp,
      nodeId: this.nodeId,
      payload: {
        panelId,
        zIndex,
      },
    };
  }

  /**
   * Create an update panel explore state operation
   */
  createUpdatePanelExploreStateOperation(
    panelId: string,
    exploreState: SerializedExploreState | undefined
  ): UpdatePanelExploreStateOperation | null {
    if (!this.state.panels.contains(panelId)) {
      return null;
    }

    const timestamp = this.clock.tick();
    return {
      type: 'update-panel-explore-state',
      mapUid: this.mapUid,
      operationId: uuidv4(),
      timestamp,
      nodeId: this.nodeId,
      payload: {
        panelId,
        exploreState,
      },
    };
  }

  /**
   * Create an update title operation
   */
  createUpdateTitleOperation(title: string): UpdateTitleOperation {
    const timestamp = this.clock.tick();
    return {
      type: 'update-title',
      mapUid: this.mapUid,
      operationId: uuidv4(),
      timestamp,
      nodeId: this.nodeId,
      payload: {
        title,
      },
    };
  }

  /**
   * Apply a CRDT operation to the state
   */
  applyOperation(operation: CRDTOperation): OperationResult {
    // Update clock with received timestamp
    this.clock.update(operation.timestamp);

    try {
      switch (operation.type) {
        case 'add-panel':
          return this.applyAddPanel(operation);
        case 'remove-panel':
          return this.applyRemovePanel(operation);
        case 'update-panel-position':
          return this.applyUpdatePanelPosition(operation);
        case 'update-panel-size':
          return this.applyUpdatePanelSize(operation);
        case 'update-panel-zindex':
          return this.applyUpdatePanelZIndex(operation);
        case 'update-panel-explore-state':
          return this.applyUpdatePanelExploreState(operation);
        case 'update-title':
          return this.applyUpdateTitle(operation);
        case 'batch':
          return this.applyBatchOperation(operation);
        default:
          return {
            success: false,
            applied: false,
            error: `Unknown operation type: ${(operation as any).type}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        applied: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private applyAddPanel(operation: AddPanelOperation): OperationResult {
    const { panelId, exploreId, position } = operation.payload;

    // Add to OR-Set with operation ID as tag
    this.state.panels.add(panelId, operation.operationId);

    // Initialize panel data if it doesn't exist
    if (!this.state.panelData.has(panelId)) {
      const zIndex = this.state.zIndexCounter.next(operation.nodeId);

      this.state.panelData.set(panelId, {
        id: panelId,
        exploreId,
        positionX: new LWWRegister(position.x, operation.timestamp),
        positionY: new LWWRegister(position.y, operation.timestamp),
        width: new LWWRegister(position.width, operation.timestamp),
        height: new LWWRegister(position.height, operation.timestamp),
        zIndex: new LWWRegister(zIndex, operation.timestamp),
        exploreState: new LWWRegister(undefined, operation.timestamp),
      });
    }

    return { success: true, applied: true };
  }

  private applyRemovePanel(operation: RemovePanelOperation): OperationResult {
    const { panelId, observedTags } = operation.payload;

    // Remove from OR-Set
    this.state.panels.remove(panelId, observedTags);

    // Keep panel data as tombstone for CRDT correctness
    // (Don't delete from panelData map - needed for merging)

    return { success: true, applied: true };
  }

  private applyUpdatePanelPosition(operation: UpdatePanelPositionOperation): OperationResult {
    const { panelId, x, y } = operation.payload;
    const panelData = this.state.panelData.get(panelId);

    if (!panelData) {
      return { success: true, applied: false, error: 'Panel not found' };
    }

    const xUpdated = panelData.positionX.set(x, operation.timestamp);
    const yUpdated = panelData.positionY.set(y, operation.timestamp);

    return {
      success: true,
      applied: xUpdated || yUpdated,
    };
  }

  private applyUpdatePanelSize(operation: UpdatePanelSizeOperation): OperationResult {
    const { panelId, width, height } = operation.payload;
    const panelData = this.state.panelData.get(panelId);

    if (!panelData) {
      return { success: true, applied: false, error: 'Panel not found' };
    }

    const widthUpdated = panelData.width.set(width, operation.timestamp);
    const heightUpdated = panelData.height.set(height, operation.timestamp);

    return {
      success: true,
      applied: widthUpdated || heightUpdated,
    };
  }

  private applyUpdatePanelZIndex(operation: UpdatePanelZIndexOperation): OperationResult {
    const { panelId, zIndex } = operation.payload;
    const panelData = this.state.panelData.get(panelId);

    if (!panelData) {
      return { success: true, applied: false, error: 'Panel not found' };
    }

    const updated = panelData.zIndex.set(zIndex, operation.timestamp);

    return {
      success: true,
      applied: updated,
    };
  }

  private applyUpdatePanelExploreState(operation: UpdatePanelExploreStateOperation): OperationResult {
    const { panelId, exploreState } = operation.payload;
    const panelData = this.state.panelData.get(panelId);

    if (!panelData) {
      return { success: true, applied: false, error: 'Panel not found' };
    }

    const updated = panelData.exploreState.set(exploreState, operation.timestamp);

    return {
      success: true,
      applied: updated,
    };
  }

  private applyUpdateTitle(operation: UpdateTitleOperation): OperationResult {
    const { title } = operation.payload;
    const updated = this.state.title.set(title, operation.timestamp);

    return {
      success: true,
      applied: updated,
    };
  }

  private applyBatchOperation(operation: any): OperationResult {
    let anyApplied = false;
    const errors: string[] = [];

    for (const subOp of operation.payload.operations) {
      const result = this.applyOperation(subOp);
      if (!result.success) {
        errors.push(result.error || 'Unknown error');
      }
      if (result.applied) {
        anyApplied = true;
      }
    }

    return {
      success: errors.length === 0,
      applied: anyApplied,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
  }

  /**
   * Merge another CRDT state into this one
   */
  mergeState(other: CRDTExploreMapState): void {
    // Merge title
    this.state.title.merge(other.title);

    // Merge panel OR-Set
    this.state.panels.merge(other.panels);

    // Merge panel data
    for (const [panelId, otherPanelData] of other.panelData.entries()) {
      const myPanelData = this.state.panelData.get(panelId);

      if (!myPanelData) {
        // Panel doesn't exist locally - copy it
        this.state.panelData.set(panelId, {
          id: otherPanelData.id,
          exploreId: otherPanelData.exploreId,
          positionX: otherPanelData.positionX.clone(),
          positionY: otherPanelData.positionY.clone(),
          width: otherPanelData.width.clone(),
          height: otherPanelData.height.clone(),
          zIndex: otherPanelData.zIndex.clone(),
          exploreState: otherPanelData.exploreState.clone(),
        });
      } else {
        // Merge each LWW register
        myPanelData.positionX.merge(otherPanelData.positionX);
        myPanelData.positionY.merge(otherPanelData.positionY);
        myPanelData.width.merge(otherPanelData.width);
        myPanelData.height.merge(otherPanelData.height);
        myPanelData.zIndex.merge(otherPanelData.zIndex);
        myPanelData.exploreState.merge(otherPanelData.exploreState);
      }
    }

    // Merge z-index counter
    this.state.zIndexCounter.merge(other.zIndexCounter);
  }

  /**
   * Serialize state to JSON
   */
  toJSON(): CRDTExploreMapStateJSON {
    const panelData: Record<string, any> = {};

    for (const [panelId, data] of this.state.panelData.entries()) {
      panelData[panelId] = {
        id: data.id,
        exploreId: data.exploreId,
        positionX: data.positionX.toJSON(),
        positionY: data.positionY.toJSON(),
        width: data.width.toJSON(),
        height: data.height.toJSON(),
        zIndex: data.zIndex.toJSON(),
        exploreState: data.exploreState.toJSON(),
      };
    }

    return {
      uid: this.state.uid,
      title: this.state.title.toJSON(),
      panels: this.state.panels.toJSON(),
      panelData,
      zIndexCounter: this.state.zIndexCounter.toJSON(),
    };
  }

  /**
   * Load state from JSON
   */
  static fromJSON(json: CRDTExploreMapStateJSON, nodeId?: string): CRDTStateManager {
    const manager = new CRDTStateManager(json.uid || '', nodeId);

    manager.state.uid = json.uid;
    manager.state.title = LWWRegister.fromJSON(json.title);
    manager.state.panels = ORSet.fromJSON(json.panels);
    manager.state.zIndexCounter = PNCounter.fromJSON(json.zIndexCounter);

    // Load panel data
    for (const [panelId, data] of Object.entries(json.panelData)) {
      manager.state.panelData.set(panelId, {
        id: data.id,
        exploreId: data.exploreId,
        positionX: LWWRegister.fromJSON(data.positionX),
        positionY: LWWRegister.fromJSON(data.positionY),
        width: LWWRegister.fromJSON(data.width),
        height: LWWRegister.fromJSON(data.height),
        zIndex: LWWRegister.fromJSON(data.zIndex),
        exploreState: LWWRegister.fromJSON(data.exploreState),
      });
    }

    return manager;
  }
}
