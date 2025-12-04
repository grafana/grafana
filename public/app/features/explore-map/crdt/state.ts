/**
 * CRDT State Manager for Explore Map
 *
 * This class manages the CRDT-based state and provides high-level
 * operations for adding/removing/updating panels.
 */

import { v4 as uuidv4 } from 'uuid';

import { ExploreMapPanel, ExploreMapFrame, SerializedExploreState } from '../state/types';

import { HybridLogicalClock } from './hlc';
import { LWWRegister, createLWWRegister } from './lwwregister';
import { ORSet } from './orset';
import { PNCounter } from './pncounter';
import {
  CRDTExploreMapState,
  CRDTPanelData,
  CRDTFrameData,
  CRDTPostItNoteData,
  CRDTOperation,
  AddPanelOperation,
  RemovePanelOperation,
  UpdatePanelPositionOperation,
  UpdatePanelSizeOperation,
  UpdatePanelZIndexOperation,
  UpdatePanelExploreStateOperation,
  UpdatePanelIframeUrlOperation,
  UpdateTitleOperation,
  AddCommentOperation,
  RemoveCommentOperation,
  AddFrameOperation,
  RemoveFrameOperation,
  UpdateFramePositionOperation,
  UpdateFrameSizeOperation,
  UpdateFrameTitleOperation,
  UpdateFrameColorOperation,
  UpdateFrameEmojiOperation,
  AssociatePanelWithFrameOperation,
  DisassociatePanelFromFrameOperation,
  AddPostItOperation,
  RemovePostItOperation,
  UpdatePostItPositionOperation,
  UpdatePostItSizeOperation,
  UpdatePostItZIndexOperation,
  UpdatePostItTextOperation,
  UpdatePostItColorOperation,
  OperationResult,
  CRDTExploreMapStateJSON,
  CommentData,
  BatchOperation,
} from './types';

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
      comments: new ORSet<string>(),
      commentData: new Map(),
      postItNotes: new ORSet<string>(),
      postItNoteData: new Map(),
      panels: new ORSet<string>(),
      panelData: new Map(),
      frames: new ORSet<string>(),
      frameData: new Map(),
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
      mode: data.mode.get(),
      iframeUrl: data.iframeUrl.get(),
      createdBy: data.createdBy.get(),
      frameId: data.frameId.get(),
      frameOffsetX: data.frameOffsetX.get(),
      frameOffsetY: data.frameOffsetY.get(),
      remoteVersion: data.remoteVersion,
    };
  }

  /**
   * Get all panels for UI rendering
   */
  getAllPanelsForUI(): Record<string, ExploreMapPanel> {
    const panels: Record<string, ExploreMapPanel> = {};
    for (const panelId of this.getPanelIds()) {
      const panel = this.getPanelForUI(panelId);
      if (panel) {
        panels[panelId] = panel;
      }
    }
    return panels;
  }

  /**
   * Get all frame IDs currently in the set
   */
  getFrameIds(): string[] {
    return this.state.frames.values();
  }

  /**
   * Get frame data by ID
   */
  getFrameData(frameId: string): CRDTFrameData | undefined {
    if (!this.state.frames.contains(frameId)) {
      return undefined;
    }
    return this.state.frameData.get(frameId);
  }

  /**
   * Get a plain object representation of a frame for UI rendering
   */
  getFrameForUI(frameId: string) {
    const data = this.getFrameData(frameId);
    if (!data) {
      return undefined;
    }

    return {
      id: data.id,
      title: data.title.get(),
      position: {
        x: data.positionX.get(),
        y: data.positionY.get(),
        width: data.width.get(),
        height: data.height.get(),
        zIndex: data.zIndex.get(),
      },
      createdBy: data.createdBy.get(),
      color: data.color.get(),
      emoji: data.emoji.get(),
      remoteVersion: data.remoteVersion,
    };
  }

  /**
   * Get all frames for UI rendering
   */
  getAllFramesForUI(): Record<string, ExploreMapFrame> {
    const frames: Record<string, ExploreMapFrame> = {};
    for (const frameId of this.getFrameIds()) {
      const frame = this.getFrameForUI(frameId);
      if (frame) {
        frames[frameId] = frame;
      }
    }
    return frames;
  }

  /**
   * Helper to get all panels in a frame
   */
  getPanelsInFrame(frameId: string): string[] {
    const panelIds: string[] = [];
    for (const panelId of this.getPanelIds()) {
      const panel = this.getPanelData(panelId);
      if (panel && panel.frameId.get() === frameId) {
        panelIds.push(panelId);
      }
    }
    return panelIds;
  }

  /**
   * Create an add panel operation
   */
  createAddPanelOperation(
    panelId: string,
    exploreId: string,
    position: { x: number; y: number; width: number; height: number },
    mode: 'explore' | 'traces-drilldown' | 'metrics-drilldown' | 'profiles-drilldown' | 'logs-drilldown' = 'explore',
    createdBy?: string,
    initialExploreState?: SerializedExploreState
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
        mode,
        createdBy,
        initialExploreState,
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
   * Create an update panel iframe URL operation
   */
  createUpdatePanelIframeUrlOperation(
    panelId: string,
    iframeUrl: string | undefined
  ): UpdatePanelIframeUrlOperation | null {
    if (!this.state.panels.contains(panelId)) {
      return null;
    }

    const timestamp = this.clock.tick();
    return {
      type: 'update-panel-iframe-url',
      mapUid: this.mapUid,
      operationId: uuidv4(),
      timestamp,
      nodeId: this.nodeId,
      payload: {
        panelId,
        iframeUrl,
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
   * Create an add comment operation
   */
  createAddCommentOperation(commentId: string, comment: CommentData): AddCommentOperation {
    const timestamp = this.clock.tick();
    return {
      type: 'add-comment',
      mapUid: this.mapUid,
      operationId: uuidv4(),
      timestamp,
      nodeId: this.nodeId,
      payload: {
        commentId,
        comment,
      },
    };
  }

  /**
   * Create a remove comment operation
   */
  createRemoveCommentOperation(commentId: string): RemoveCommentOperation {
    const timestamp = this.clock.tick();
    const observedTags = this.state.comments.getTags(commentId);
    return {
      type: 'remove-comment',
      mapUid: this.mapUid,
      operationId: uuidv4(),
      timestamp,
      nodeId: this.nodeId,
      payload: {
        commentId,
        observedTags,
      },
    };
  }

  /**
   * Create an add frame operation
   */
  createAddFrameOperation(
    frameId: string,
    title: string,
    position: { x: number; y: number; width: number; height: number },
    createdBy?: string,
    color?: string,
    emoji?: string
  ): AddFrameOperation {
    const timestamp = this.clock.tick();
    return {
      type: 'add-frame',
      mapUid: this.mapUid,
      operationId: uuidv4(),
      timestamp,
      nodeId: this.nodeId,
      payload: { frameId, title, position, createdBy, color, emoji },
    };
  }

  /**
   * Create a remove frame operation
   */
  createRemoveFrameOperation(frameId: string): RemoveFrameOperation | null {
    if (!this.state.frames.contains(frameId)) {
      return null;
    }

    const timestamp = this.clock.tick();
    const observedTags = this.state.frames.getTags(frameId);

    return {
      type: 'remove-frame',
      mapUid: this.mapUid,
      operationId: uuidv4(),
      timestamp,
      nodeId: this.nodeId,
      payload: { frameId, observedTags },
    };
  }

  /**
   * Create an update frame position operation
   */
  createUpdateFramePositionOperation(
    frameId: string,
    x: number,
    y: number,
    deltaX: number,
    deltaY: number
  ): UpdateFramePositionOperation | null {
    if (!this.state.frames.contains(frameId)) {
      return null;
    }

    const timestamp = this.clock.tick();
    return {
      type: 'update-frame-position',
      mapUid: this.mapUid,
      operationId: uuidv4(),
      timestamp,
      nodeId: this.nodeId,
      payload: { frameId, x, y, deltaX, deltaY },
    };
  }

  /**
   * Create an update frame size operation
   */
  createUpdateFrameSizeOperation(
    frameId: string,
    width: number,
    height: number
  ): UpdateFrameSizeOperation | null {
    if (!this.state.frames.contains(frameId)) {
      return null;
    }

    const timestamp = this.clock.tick();
    return {
      type: 'update-frame-size',
      mapUid: this.mapUid,
      operationId: uuidv4(),
      timestamp,
      nodeId: this.nodeId,
      payload: { frameId, width, height },
    };
  }

  /**
   * Create an update frame title operation
   */
  createUpdateFrameTitleOperation(
    frameId: string,
    title: string
  ): UpdateFrameTitleOperation | null {
    if (!this.state.frames.contains(frameId)) {
      return null;
    }

    const timestamp = this.clock.tick();
    return {
      type: 'update-frame-title',
      mapUid: this.mapUid,
      operationId: uuidv4(),
      timestamp,
      nodeId: this.nodeId,
      payload: { frameId, title },
    };
  }

  /**
   * Create an update frame color operation
   */
  createUpdateFrameColorOperation(
    frameId: string,
    color: string | undefined
  ): UpdateFrameColorOperation | null {
    if (!this.state.frames.contains(frameId)) {
      return null;
    }

    const timestamp = this.clock.tick();
    return {
      type: 'update-frame-color',
      mapUid: this.mapUid,
      operationId: uuidv4(),
      timestamp,
      nodeId: this.nodeId,
      payload: { frameId, color },
    };
  }

  /**
   * Create an update frame emoji operation
   */
  createUpdateFrameEmojiOperation(
    frameId: string,
    emoji: string | undefined
  ): UpdateFrameEmojiOperation | null {
    if (!this.state.frames.contains(frameId)) {
      return null;
    }

    const timestamp = this.clock.tick();
    return {
      type: 'update-frame-emoji',
      mapUid: this.mapUid,
      operationId: uuidv4(),
      timestamp,
      nodeId: this.nodeId,
      payload: { frameId, emoji },
    };
  }

  /**
   * Create an associate panel with frame operation
   */
  createAssociatePanelWithFrameOperation(
    panelId: string,
    frameId: string,
    offsetX: number,
    offsetY: number
  ): AssociatePanelWithFrameOperation | null {
    if (!this.state.panels.contains(panelId)) {
      return null;
    }

    const timestamp = this.clock.tick();
    return {
      type: 'associate-panel-with-frame',
      mapUid: this.mapUid,
      operationId: uuidv4(),
      timestamp,
      nodeId: this.nodeId,
      payload: { panelId, frameId, offsetX, offsetY },
    };
  }

  /**
   * Create a disassociate panel from frame operation
   */
  createDisassociatePanelFromFrameOperation(
    panelId: string
  ): DisassociatePanelFromFrameOperation | null {
    if (!this.state.panels.contains(panelId)) {
      return null;
    }

    const timestamp = this.clock.tick();
    return {
      type: 'disassociate-panel-from-frame',
      mapUid: this.mapUid,
      operationId: uuidv4(),
      timestamp,
      nodeId: this.nodeId,
      payload: { panelId },
    };
  }

  /**
   * Get all comment IDs
   */
  getCommentIds(): string[] {
    return this.state.comments.values();
  }

  /**
   * Get comment data by ID
   */
  getCommentData(commentId: string): CommentData | undefined {
    if (!this.state.comments.contains(commentId)) {
      return undefined;
    }
    return this.state.commentData.get(commentId);
  }

  /**
   * Get all comments as an array, sorted by timestamp (newest first)
   */
  getCommentsForUI(): Array<{ id: string; data: CommentData }> {
    const commentIds = this.getCommentIds();
    const comments = commentIds
      .map((id) => {
        const data = this.getCommentData(id);
        return data ? { id, data } : null;
      })
      .filter((c): c is { id: string; data: CommentData } => c !== null);

    // Sort by timestamp, newest first
    return comments.sort((a, b) => b.data.timestamp - a.data.timestamp);
  }

  /**
   * Create an add post-it note operation
   */
  createAddPostItOperation(
    postItId: string,
    position: { x: number; y: number; width: number; height: number },
    text?: string,
    color?: string,
    createdBy?: string
  ): AddPostItOperation {
    const timestamp = this.clock.tick();
    return {
      type: 'add-postit',
      mapUid: this.mapUid,
      operationId: uuidv4(),
      timestamp,
      nodeId: this.nodeId,
      payload: {
        postItId,
        position,
        text: text || '',
        color: color || 'blue',
        createdBy,
      },
    };
  }

  /**
   * Create a remove post-it note operation
   */
  createRemovePostItOperation(postItId: string): RemovePostItOperation | null {
    if (!this.state.postItNotes.contains(postItId)) {
      return null;
    }

    const timestamp = this.clock.tick();
    const observedTags = this.state.postItNotes.getTags(postItId);

    return {
      type: 'remove-postit',
      mapUid: this.mapUid,
      operationId: uuidv4(),
      timestamp,
      nodeId: this.nodeId,
      payload: {
        postItId,
        observedTags,
      },
    };
  }

  /**
   * Create an update post-it note position operation
   */
  createUpdatePostItPositionOperation(postItId: string, x: number, y: number): UpdatePostItPositionOperation | null {
    if (!this.state.postItNotes.contains(postItId)) {
      return null;
    }

    const timestamp = this.clock.tick();
    return {
      type: 'update-postit-position',
      mapUid: this.mapUid,
      operationId: uuidv4(),
      timestamp,
      nodeId: this.nodeId,
      payload: {
        postItId,
        x,
        y,
      },
    };
  }

  /**
   * Create an update post-it note size operation
   */
  createUpdatePostItSizeOperation(postItId: string, width: number, height: number): UpdatePostItSizeOperation | null {
    if (!this.state.postItNotes.contains(postItId)) {
      return null;
    }

    const timestamp = this.clock.tick();
    return {
      type: 'update-postit-size',
      mapUid: this.mapUid,
      operationId: uuidv4(),
      timestamp,
      nodeId: this.nodeId,
      payload: {
        postItId,
        width,
        height,
      },
    };
  }

  /**
   * Create an update post-it note z-index operation
   */
  createUpdatePostItZIndexOperation(postItId: string): UpdatePostItZIndexOperation | null {
    if (!this.state.postItNotes.contains(postItId)) {
      return null;
    }

    const timestamp = this.clock.tick();
    const zIndex = this.state.zIndexCounter.next(this.nodeId);

    return {
      type: 'update-postit-zindex',
      mapUid: this.mapUid,
      operationId: uuidv4(),
      timestamp,
      nodeId: this.nodeId,
      payload: {
        postItId,
        zIndex,
      },
    };
  }

  /**
   * Create an update post-it note text operation
   */
  createUpdatePostItTextOperation(postItId: string, text: string): UpdatePostItTextOperation | null {
    if (!this.state.postItNotes.contains(postItId)) {
      return null;
    }

    const timestamp = this.clock.tick();
    return {
      type: 'update-postit-text',
      mapUid: this.mapUid,
      operationId: uuidv4(),
      timestamp,
      nodeId: this.nodeId,
      payload: {
        postItId,
        text,
      },
    };
  }

  /**
   * Create an update post-it note color operation
   */
  createUpdatePostItColorOperation(postItId: string, color: string): UpdatePostItColorOperation | null {
    if (!this.state.postItNotes.contains(postItId)) {
      return null;
    }

    const timestamp = this.clock.tick();
    return {
      type: 'update-postit-color',
      mapUid: this.mapUid,
      operationId: uuidv4(),
      timestamp,
      nodeId: this.nodeId,
      payload: {
        postItId,
        color,
      },
    };
  }

  /**
   * Get all post-it note IDs
   */
  getPostItNoteIds(): string[] {
    return this.state.postItNotes.values();
  }

  /**
   * Get post-it note data by ID
   */
  getPostItNoteData(postItId: string): CRDTPostItNoteData | undefined {
    if (!this.state.postItNotes.contains(postItId)) {
      return undefined;
    }
    return this.state.postItNoteData.get(postItId);
  }

  /**
   * Get a plain object representation of a post-it note for UI rendering
   */
  getPostItNoteForUI(postItId: string) {
    const data = this.getPostItNoteData(postItId);
    if (!data) {
      return undefined;
    }

    return {
      id: data.id,
      position: {
        x: data.positionX.get(),
        y: data.positionY.get(),
        width: data.width.get(),
        height: data.height.get(),
        zIndex: data.zIndex.get(),
      },
      text: data.text.get(),
      color: data.color.get(),
      createdBy: data.createdBy.get(),
    };
  }

  /**
   * Get all post-it notes for UI rendering
   */
  getAllPostItNotesForUI(): Record<string, {
    id: string;
    position: { x: number; y: number; width: number; height: number; zIndex: number };
    text: string;
    color: string;
    createdBy?: string;
  }> {
    const postItNotes: Record<string, {
      id: string;
      position: { x: number; y: number; width: number; height: number; zIndex: number };
      text: string;
      color: string;
      createdBy?: string;
    }> = {};
    for (const postItId of this.getPostItNoteIds()) {
      const postIt = this.getPostItNoteForUI(postItId);
      if (postIt) {
        postItNotes[postItId] = postIt;
      }
    }
    return postItNotes;
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
        case 'update-panel-iframe-url':
          return this.applyUpdatePanelIframeUrl(operation);
        case 'update-title':
          return this.applyUpdateTitle(operation);
        case 'add-comment':
          return this.applyAddComment(operation);
        case 'remove-comment':
          return this.applyRemoveComment(operation);
        case 'add-frame':
          return this.applyAddFrame(operation);
        case 'remove-frame':
          return this.applyRemoveFrame(operation);
        case 'update-frame-position':
          return this.applyUpdateFramePosition(operation);
        case 'update-frame-size':
          return this.applyUpdateFrameSize(operation);
        case 'update-frame-title':
          return this.applyUpdateFrameTitle(operation);
        case 'update-frame-color':
          return this.applyUpdateFrameColor(operation);
        case 'update-frame-emoji':
          return this.applyUpdateFrameEmoji(operation);
        case 'associate-panel-with-frame':
          return this.applyAssociatePanelWithFrame(operation);
        case 'disassociate-panel-from-frame':
          return this.applyDisassociatePanelFromFrame(operation);
        case 'add-postit':
          return this.applyAddPostIt(operation);
        case 'remove-postit':
          return this.applyRemovePostIt(operation);
        case 'update-postit-position':
          return this.applyUpdatePostItPosition(operation);
        case 'update-postit-size':
          return this.applyUpdatePostItSize(operation);
        case 'update-postit-zindex':
          return this.applyUpdatePostItZIndex(operation);
        case 'update-postit-text':
          return this.applyUpdatePostItText(operation);
        case 'update-postit-color':
          return this.applyUpdatePostItColor(operation);
        case 'batch':
          return this.applyBatchOperation(operation);
        default: {
          // TypeScript exhaustiveness check - this should never happen at runtime
          const exhaustiveCheck: never = operation;
          return {
            success: false,
            applied: false,
            error: `Unknown operation type: ${(exhaustiveCheck as { type: string }).type}`,
          };
        }
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
    const { panelId, exploreId, position, mode, createdBy, initialExploreState } = operation.payload;
    const panelMode = mode || 'explore';

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
        exploreState: new LWWRegister(initialExploreState, operation.timestamp),
        mode: new LWWRegister(panelMode, operation.timestamp),
        iframeUrl: new LWWRegister(undefined, operation.timestamp),
        createdBy: new LWWRegister(createdBy, operation.timestamp),
        frameId: new LWWRegister(undefined, operation.timestamp),
        frameOffsetX: new LWWRegister(undefined, operation.timestamp),
        frameOffsetY: new LWWRegister(undefined, operation.timestamp),
        remoteVersion: 0,
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
    const updated = xUpdated || yUpdated;

    // Note: We don't increment remoteVersion for position changes
    // Position updates should not trigger content re-renders

    return {
      success: true,
      applied: updated,
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
    const updated = widthUpdated || heightUpdated;

    // Note: Size changes are handled by width/height props in ExploreMapPanelContent
    // They trigger re-renders through the React.memo comparison, not remoteVersion

    return {
      success: true,
      applied: updated,
    };
  }

  private applyUpdatePanelZIndex(operation: UpdatePanelZIndexOperation): OperationResult {
    const { panelId, zIndex } = operation.payload;
    const panelData = this.state.panelData.get(panelId);

    if (!panelData) {
      return { success: true, applied: false, error: 'Panel not found' };
    }

    const updated = panelData.zIndex.set(zIndex, operation.timestamp);

    // Note: We don't increment remoteVersion for zIndex changes
    // zIndex is a visual property that doesn't affect content

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

    // Increment remoteVersion only for remote operations
    if (updated && operation.nodeId !== this.nodeId) {
      panelData.remoteVersion++;
    }

    return {
      success: true,
      applied: updated,
    };
  }

  private applyUpdatePanelIframeUrl(operation: UpdatePanelIframeUrlOperation): OperationResult {
    const { panelId, iframeUrl } = operation.payload;
    const panelData = this.state.panelData.get(panelId);

    if (!panelData) {
      return { success: true, applied: false, error: 'Panel not found' };
    }

    const updated = panelData.iframeUrl.set(iframeUrl, operation.timestamp);

    // Increment remoteVersion only for remote operations
    if (updated && operation.nodeId !== this.nodeId) {
      panelData.remoteVersion++;
    }

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

  private applyAddComment(operation: AddCommentOperation): OperationResult {
    const { commentId, comment } = operation.payload;

    // Add to OR-Set using operation ID as the tag
    this.state.comments.add(commentId, operation.operationId);

    // Store comment data
    this.state.commentData.set(commentId, comment);

    return {
      success: true,
      applied: true,
    };
  }

  private applyRemoveComment(operation: RemoveCommentOperation): OperationResult {
    const { commentId, observedTags } = operation.payload;

    // Check if comment exists before removing
    const existed = this.state.comments.contains(commentId);

    // Remove from OR-Set
    this.state.comments.remove(commentId, observedTags);

    // Remove comment data if it existed
    if (existed) {
      this.state.commentData.delete(commentId);
    }

    return {
      success: true,
      applied: existed,
    };
  }

  private applyAddPostIt(operation: AddPostItOperation): OperationResult {
    const { postItId, position, text, color, createdBy } = operation.payload;

    // Add to OR-Set with operation ID as tag
    this.state.postItNotes.add(postItId, operation.operationId);

    // Initialize post-it note data if it doesn't exist
    if (!this.state.postItNoteData.has(postItId)) {
      const zIndex = this.state.zIndexCounter.next(operation.nodeId);

      this.state.postItNoteData.set(postItId, {
        id: postItId,
        positionX: new LWWRegister(position.x, operation.timestamp),
        positionY: new LWWRegister(position.y, operation.timestamp),
        width: new LWWRegister(position.width, operation.timestamp),
        height: new LWWRegister(position.height, operation.timestamp),
        zIndex: new LWWRegister(zIndex, operation.timestamp),
        text: new LWWRegister(text || '', operation.timestamp),
        color: new LWWRegister(color || 'purple', operation.timestamp),
        createdBy: new LWWRegister(createdBy, operation.timestamp),
      });
    }

    return { success: true, applied: true };
  }

  private applyRemovePostIt(operation: RemovePostItOperation): OperationResult {
    const { postItId, observedTags } = operation.payload;

    // Check if post-it note exists before removing
    const existed = this.state.postItNotes.contains(postItId);

    // Remove from OR-Set
    this.state.postItNotes.remove(postItId, observedTags);

    // Remove post-it note data if it existed
    if (existed) {
      this.state.postItNoteData.delete(postItId);
    }

    return {
      success: true,
      applied: existed,
    };
  }

  private applyUpdatePostItPosition(operation: UpdatePostItPositionOperation): OperationResult {
    const { postItId, x, y } = operation.payload;
    const postItData = this.state.postItNoteData.get(postItId);

    if (!postItData) {
      return { success: true, applied: false, error: 'Post-it note not found' };
    }

    const xUpdated = postItData.positionX.set(x, operation.timestamp);
    const yUpdated = postItData.positionY.set(y, operation.timestamp);
    const updated = xUpdated || yUpdated;

    return {
      success: true,
      applied: updated,
    };
  }

  private applyUpdatePostItSize(operation: UpdatePostItSizeOperation): OperationResult {
    const { postItId, width, height } = operation.payload;
    const postItData = this.state.postItNoteData.get(postItId);

    if (!postItData) {
      return { success: true, applied: false, error: 'Post-it note not found' };
    }

    const widthUpdated = postItData.width.set(width, operation.timestamp);
    const heightUpdated = postItData.height.set(height, operation.timestamp);
    const updated = widthUpdated || heightUpdated;

    return {
      success: true,
      applied: updated,
    };
  }

  private applyUpdatePostItZIndex(operation: UpdatePostItZIndexOperation): OperationResult {
    const { postItId, zIndex } = operation.payload;
    const postItData = this.state.postItNoteData.get(postItId);

    if (!postItData) {
      return { success: true, applied: false, error: 'Post-it note not found' };
    }

    const updated = postItData.zIndex.set(zIndex, operation.timestamp);

    return {
      success: true,
      applied: updated,
    };
  }

  private applyUpdatePostItText(operation: UpdatePostItTextOperation): OperationResult {
    const { postItId, text } = operation.payload;
    const postItData = this.state.postItNoteData.get(postItId);

    if (!postItData) {
      return { success: true, applied: false, error: 'Post-it note not found' };
    }

    const updated = postItData.text.set(text, operation.timestamp);

    return {
      success: true,
      applied: updated,
    };
  }

  private applyUpdatePostItColor(operation: UpdatePostItColorOperation): OperationResult {
    const { postItId, color } = operation.payload;
    const postItData = this.state.postItNoteData.get(postItId);

    if (!postItData) {
      return { success: true, applied: false, error: 'Post-it note not found' };
    }

    const updated = postItData.color.set(color, operation.timestamp);

    return {
      success: true,
      applied: updated,
    };
  }

  private applyBatchOperation(operation: BatchOperation): OperationResult {
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

  private applyAddFrame(operation: AddFrameOperation): OperationResult {
    const { frameId, title, position, createdBy, color, emoji } = operation.payload;

    // Add to OR-Set with operation ID as tag
    this.state.frames.add(frameId, operation.operationId);

    // Initialize frame data if it doesn't exist
    if (!this.state.frameData.has(frameId)) {
      // Frames always use z-index 0 to stay below panels
      // Panels start from z-index 1 and increment from there
      const zIndex = 0;

      this.state.frameData.set(frameId, {
        id: frameId,
        title: new LWWRegister(title, operation.timestamp),
        positionX: new LWWRegister(position.x, operation.timestamp),
        positionY: new LWWRegister(position.y, operation.timestamp),
        width: new LWWRegister(position.width, operation.timestamp),
        height: new LWWRegister(position.height, operation.timestamp),
        zIndex: new LWWRegister(zIndex, operation.timestamp),
        color: new LWWRegister(color, operation.timestamp),
        emoji: new LWWRegister(emoji, operation.timestamp),
        createdBy: new LWWRegister(createdBy, operation.timestamp),
        remoteVersion: 0,
      });
    }

    return { success: true, applied: true };
  }

  private applyRemoveFrame(operation: RemoveFrameOperation): OperationResult {
    const { frameId, observedTags } = operation.payload;

    // Remove from OR-Set
    this.state.frames.remove(frameId, observedTags);

    // Disassociate all panels from this frame
    for (const panelId of this.getPanelIds()) {
      const panel = this.state.panelData.get(panelId);
      if (panel && panel.frameId.get() === frameId) {
        panel.frameId.set(undefined, operation.timestamp);
        panel.frameOffsetX.set(undefined, operation.timestamp);
        panel.frameOffsetY.set(undefined, operation.timestamp);
      }
    }

    // Keep frame data as tombstone for CRDT correctness
    return { success: true, applied: true };
  }

  private applyUpdateFramePosition(operation: UpdateFramePositionOperation): OperationResult {
    const { frameId, x, y } = operation.payload;
    const frameData = this.state.frameData.get(frameId);

    if (!frameData) {
      return { success: true, applied: false, error: 'Frame not found' };
    }

    const xUpdated = frameData.positionX.set(x, operation.timestamp);
    const yUpdated = frameData.positionY.set(y, operation.timestamp);

    return { success: true, applied: xUpdated || yUpdated };
  }

  private applyUpdateFrameSize(operation: UpdateFrameSizeOperation): OperationResult {
    const { frameId, width, height } = operation.payload;
    const frameData = this.state.frameData.get(frameId);

    if (!frameData) {
      return { success: true, applied: false, error: 'Frame not found' };
    }

    const widthUpdated = frameData.width.set(width, operation.timestamp);
    const heightUpdated = frameData.height.set(height, operation.timestamp);

    return { success: true, applied: widthUpdated || heightUpdated };
  }

  private applyUpdateFrameTitle(operation: UpdateFrameTitleOperation): OperationResult {
    const { frameId, title } = operation.payload;
    const frameData = this.state.frameData.get(frameId);

    if (!frameData) {
      return { success: true, applied: false, error: 'Frame not found' };
    }

    const updated = frameData.title.set(title, operation.timestamp);

    // Increment remoteVersion only for remote operations
    if (updated && operation.nodeId !== this.nodeId) {
      frameData.remoteVersion++;
    }

    return { success: true, applied: updated };
  }

  private applyUpdateFrameColor(operation: UpdateFrameColorOperation): OperationResult {
    const { frameId, color } = operation.payload;
    const frameData = this.state.frameData.get(frameId);

    if (!frameData) {
      return { success: true, applied: false, error: 'Frame not found' };
    }

    const updated = frameData.color.set(color, operation.timestamp);

    return { success: true, applied: updated };
  }

  private applyUpdateFrameEmoji(operation: UpdateFrameEmojiOperation): OperationResult {
    const { frameId, emoji } = operation.payload;
    const frameData = this.state.frameData.get(frameId);

    if (!frameData) {
      return { success: true, applied: false, error: 'Frame not found' };
    }

    const updated = frameData.emoji.set(emoji, operation.timestamp);

    return { success: true, applied: updated };
  }

  private applyAssociatePanelWithFrame(operation: AssociatePanelWithFrameOperation): OperationResult {
    const { panelId, frameId, offsetX, offsetY } = operation.payload;
    const panelData = this.state.panelData.get(panelId);

    if (!panelData) {
      return { success: true, applied: false, error: 'Panel not found' };
    }

    const frameUpdated = panelData.frameId.set(frameId, operation.timestamp);
    const offsetXUpdated = panelData.frameOffsetX.set(offsetX, operation.timestamp);
    const offsetYUpdated = panelData.frameOffsetY.set(offsetY, operation.timestamp);

    return { success: true, applied: frameUpdated || offsetXUpdated || offsetYUpdated };
  }

  private applyDisassociatePanelFromFrame(operation: DisassociatePanelFromFrameOperation): OperationResult {
    const { panelId } = operation.payload;
    const panelData = this.state.panelData.get(panelId);

    if (!panelData) {
      return { success: true, applied: false, error: 'Panel not found' };
    }

    const frameUpdated = panelData.frameId.set(undefined, operation.timestamp);
    const offsetXUpdated = panelData.frameOffsetX.set(undefined, operation.timestamp);
    const offsetYUpdated = panelData.frameOffsetY.set(undefined, operation.timestamp);

    return { success: true, applied: frameUpdated || offsetXUpdated || offsetYUpdated };
  }

  /**
   * Merge another CRDT state into this one
   */
  mergeState(other: CRDTExploreMapState): void {
    // Merge title
    this.state.title.merge(other.title);

    // Merge comments OR-Set
    this.state.comments.merge(other.comments);

    // Merge comment data
    for (const [commentId, commentData] of other.commentData.entries()) {
      if (this.state.comments.contains(commentId)) {
        this.state.commentData.set(commentId, commentData);
      }
    }

    // Merge post-it notes OR-Set
    this.state.postItNotes.merge(other.postItNotes);

    // Merge post-it note data
    for (const [postItId, otherPostItData] of other.postItNoteData.entries()) {
      const myPostItData = this.state.postItNoteData.get(postItId);

      if (!myPostItData) {
        // Post-it note doesn't exist locally - copy it
        this.state.postItNoteData.set(postItId, {
          id: otherPostItData.id,
          positionX: otherPostItData.positionX.clone(),
          positionY: otherPostItData.positionY.clone(),
          width: otherPostItData.width.clone(),
          height: otherPostItData.height.clone(),
          zIndex: otherPostItData.zIndex.clone(),
          text: otherPostItData.text.clone(),
          color: otherPostItData.color.clone(),
          createdBy: otherPostItData.createdBy.clone(),
        });
      } else {
        // Merge each LWW register
        myPostItData.positionX.merge(otherPostItData.positionX);
        myPostItData.positionY.merge(otherPostItData.positionY);
        myPostItData.width.merge(otherPostItData.width);
        myPostItData.height.merge(otherPostItData.height);
        myPostItData.zIndex.merge(otherPostItData.zIndex);
        myPostItData.text.merge(otherPostItData.text);
        myPostItData.color.merge(otherPostItData.color);
        myPostItData.createdBy.merge(otherPostItData.createdBy);
      }
    }

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
          mode: otherPanelData.mode.clone(),
          iframeUrl: otherPanelData.iframeUrl.clone(),
          createdBy: otherPanelData.createdBy.clone(),
          frameId: otherPanelData.frameId.clone(),
          frameOffsetX: otherPanelData.frameOffsetX.clone(),
          frameOffsetY: otherPanelData.frameOffsetY.clone(),
          remoteVersion: otherPanelData.remoteVersion,
        });
      } else {
        // Merge each LWW register
        myPanelData.positionX.merge(otherPanelData.positionX);
        myPanelData.positionY.merge(otherPanelData.positionY);
        myPanelData.width.merge(otherPanelData.width);
        myPanelData.height.merge(otherPanelData.height);
        myPanelData.zIndex.merge(otherPanelData.zIndex);
        myPanelData.exploreState.merge(otherPanelData.exploreState);
        myPanelData.mode.merge(otherPanelData.mode);
        myPanelData.iframeUrl.merge(otherPanelData.iframeUrl);
        myPanelData.createdBy.merge(otherPanelData.createdBy);
        myPanelData.frameId.merge(otherPanelData.frameId);
        myPanelData.frameOffsetX.merge(otherPanelData.frameOffsetX);
        myPanelData.frameOffsetY.merge(otherPanelData.frameOffsetY);
      }
    }

    // Merge frame OR-Set
    this.state.frames.merge(other.frames);

    // Merge frame data
    for (const [frameId, otherFrameData] of other.frameData.entries()) {
      const myFrameData = this.state.frameData.get(frameId);

      if (!myFrameData) {
        // Frame doesn't exist locally - copy it
        this.state.frameData.set(frameId, {
          id: otherFrameData.id,
          title: otherFrameData.title.clone(),
          positionX: otherFrameData.positionX.clone(),
          positionY: otherFrameData.positionY.clone(),
          width: otherFrameData.width.clone(),
          height: otherFrameData.height.clone(),
          zIndex: otherFrameData.zIndex.clone(),
          color: otherFrameData.color.clone(),
          emoji: otherFrameData.emoji.clone(),
          createdBy: otherFrameData.createdBy.clone(),
          remoteVersion: otherFrameData.remoteVersion,
        });
      } else {
        // Merge each LWW register
        myFrameData.title.merge(otherFrameData.title);
        myFrameData.positionX.merge(otherFrameData.positionX);
        myFrameData.positionY.merge(otherFrameData.positionY);
        myFrameData.width.merge(otherFrameData.width);
        myFrameData.height.merge(otherFrameData.height);
        myFrameData.zIndex.merge(otherFrameData.zIndex);
        myFrameData.color.merge(otherFrameData.color);
        myFrameData.emoji.merge(otherFrameData.emoji);
        myFrameData.createdBy.merge(otherFrameData.createdBy);
      }
    }

    // Merge z-index counter
    this.state.zIndexCounter.merge(other.zIndexCounter);
  }

  /**
   * Serialize state to JSON
   */
  toJSON(): CRDTExploreMapStateJSON {
    const panelData: CRDTExploreMapStateJSON['panelData'] = {};

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
        mode: data.mode.toJSON(),
        iframeUrl: data.iframeUrl.toJSON(),
        createdBy: data.createdBy.toJSON(),
        frameId: data.frameId.toJSON(),
        frameOffsetX: data.frameOffsetX.toJSON(),
        frameOffsetY: data.frameOffsetY.toJSON(),
        remoteVersion: data.remoteVersion,
      };
    }

    const commentData: Record<string, CommentData> = {};
    for (const [commentId, data] of this.state.commentData.entries()) {
      if (this.state.comments.contains(commentId)) {
        commentData[commentId] = data;
      }
    }

    const frameData: CRDTExploreMapStateJSON['frameData'] = {};
    for (const [frameId, data] of this.state.frameData.entries()) {
      if (this.state.frames.contains(frameId)) {
        frameData[frameId] = {
          id: data.id,
          title: data.title.toJSON(),
          positionX: data.positionX.toJSON(),
          positionY: data.positionY.toJSON(),
          width: data.width.toJSON(),
          height: data.height.toJSON(),
          zIndex: data.zIndex.toJSON(),
          color: data.color.toJSON(),
          emoji: data.emoji.toJSON(),
          createdBy: data.createdBy.toJSON(),
          remoteVersion: data.remoteVersion,
        };
      }
    }

    const postItNoteData: CRDTExploreMapStateJSON['postItNoteData'] = {};
    for (const [postItId, data] of this.state.postItNoteData.entries()) {
      if (this.state.postItNotes.contains(postItId)) {
        postItNoteData[postItId] = {
          id: data.id,
          positionX: data.positionX.toJSON(),
          positionY: data.positionY.toJSON(),
          width: data.width.toJSON(),
          height: data.height.toJSON(),
          zIndex: data.zIndex.toJSON(),
          text: data.text.toJSON(),
          color: data.color.toJSON(),
          createdBy: data.createdBy.toJSON(),
        };
      }
    }

    return {
      uid: this.state.uid,
      title: this.state.title.toJSON(),
      comments: this.state.comments.toJSON(),
      commentData,
      postItNotes: this.state.postItNotes.toJSON(),
      postItNoteData,
      panels: this.state.panels.toJSON(),
      panelData,
      frames: this.state.frames.toJSON(),
      frameData,
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
    manager.state.comments = json.comments ? ORSet.fromJSON(json.comments) : new ORSet<string>();
    manager.state.commentData = new Map();
    if (json.commentData) {
      for (const [commentId, data] of Object.entries(json.commentData)) {
        manager.state.commentData.set(commentId, data);
      }
    }
    manager.state.postItNotes = json.postItNotes ? ORSet.fromJSON(json.postItNotes) : new ORSet<string>();
    manager.state.postItNoteData = new Map();
    if (json.postItNoteData) {
      for (const [postItId, data] of Object.entries(json.postItNoteData)) {
        const defaultTimestamp = data.positionX?.timestamp || { nodeId: manager.nodeId, counter: 0, wallClock: Date.now() };
        manager.state.postItNoteData.set(postItId, {
          id: data.id,
          positionX: LWWRegister.fromJSON(data.positionX),
          positionY: LWWRegister.fromJSON(data.positionY),
          width: LWWRegister.fromJSON(data.width),
          height: LWWRegister.fromJSON(data.height),
          zIndex: LWWRegister.fromJSON(data.zIndex),
          text: LWWRegister.fromJSON(data.text),
          color: LWWRegister.fromJSON(data.color),
          createdBy: data.createdBy ? LWWRegister.fromJSON(data.createdBy) : new LWWRegister(undefined, defaultTimestamp),
        });
      }
    }
    manager.state.panels = ORSet.fromJSON(json.panels);
    manager.state.frames = json.frames ? ORSet.fromJSON(json.frames) : new ORSet<string>();
    manager.state.zIndexCounter = PNCounter.fromJSON(json.zIndexCounter);

    // Load panel data
    for (const [panelId, data] of Object.entries(json.panelData)) {
      // Get the first timestamp from existing registers for defaults
      const defaultTimestamp = data.positionX?.timestamp || { nodeId: manager.nodeId, counter: 0, wallClock: Date.now() };
      manager.state.panelData.set(panelId, {
        id: data.id,
        exploreId: data.exploreId,
        positionX: LWWRegister.fromJSON(data.positionX),
        positionY: LWWRegister.fromJSON(data.positionY),
        width: LWWRegister.fromJSON(data.width),
        height: LWWRegister.fromJSON(data.height),
        zIndex: LWWRegister.fromJSON(data.zIndex),
        exploreState: LWWRegister.fromJSON(data.exploreState),
        mode: data.mode ? LWWRegister.fromJSON(data.mode) : new LWWRegister('explore', defaultTimestamp),
        iframeUrl: data.iframeUrl ? LWWRegister.fromJSON(data.iframeUrl) : new LWWRegister(undefined, defaultTimestamp),
        createdBy: data.createdBy ? LWWRegister.fromJSON(data.createdBy) : new LWWRegister(undefined, defaultTimestamp),
        frameId: data.frameId ? LWWRegister.fromJSON(data.frameId) : new LWWRegister(undefined, defaultTimestamp),
        frameOffsetX: data.frameOffsetX ? LWWRegister.fromJSON(data.frameOffsetX) : new LWWRegister(undefined, defaultTimestamp),
        frameOffsetY: data.frameOffsetY ? LWWRegister.fromJSON(data.frameOffsetY) : new LWWRegister(undefined, defaultTimestamp),
        remoteVersion: data.remoteVersion || 0,
      });
    }

    // Load frame data
    if (json.frameData) {
      for (const [frameId, data] of Object.entries(json.frameData)) {
        const defaultTimestamp = data.positionX?.timestamp || { nodeId: manager.nodeId, counter: 0, wallClock: Date.now() };
        manager.state.frameData.set(frameId, {
          id: data.id,
          title: LWWRegister.fromJSON(data.title),
          positionX: LWWRegister.fromJSON(data.positionX),
          positionY: LWWRegister.fromJSON(data.positionY),
          width: LWWRegister.fromJSON(data.width),
          height: LWWRegister.fromJSON(data.height),
          zIndex: LWWRegister.fromJSON(data.zIndex),
          color: data.color ? LWWRegister.fromJSON(data.color) : new LWWRegister(undefined, defaultTimestamp),
          emoji: data.emoji ? LWWRegister.fromJSON(data.emoji) : new LWWRegister(undefined, defaultTimestamp),
          createdBy: data.createdBy ? LWWRegister.fromJSON(data.createdBy) : new LWWRegister(undefined, defaultTimestamp),
          remoteVersion: data.remoteVersion || 0,
        });
      }
    }

    return manager;
  }
}
