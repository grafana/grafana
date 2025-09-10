/**
 * InteractionBridge - Foundational service for correlating dashboard and panel performance metrics
 *
 * This service provides a lightweight bridge between dashboard-level interactions (tracked by SceneRenderProfiler)
 * and panel-level performance metrics (tracked by VizPanelRenderProfiler).
 *
 * Key Features:
 * - Tracks current dashboard interaction state
 * - Provides correlation context for panel metrics
 * - Backward compatible with existing SceneRenderProfiler usage
 */

import { store } from '@grafana/data';

export interface CorrelationContext {
  /** Current interaction type (e.g., 'time_range_change', 'refresh') */
  interactionType?: string;
  /** Unique identifier for this specific interaction instance */
  interactionId?: string;
  /** Source that triggered the interaction (e.g., 'time-picker', 'refresh-button') */
  source?: string;
  /** Timestamp when interaction started */
  startTime?: number;
  /** Additional context data */
  context?: Record<string, unknown>;
}

/**
 * Lightweight bridge service for interaction correlation
 */
export class InteractionBridge {
  private static instance: InteractionBridge;
  private currentInteraction: CorrelationContext | null = null;

  private constructor() {
    // Private constructor for singleton pattern
  }

  static getInstance(): InteractionBridge {
    if (!InteractionBridge.instance) {
      InteractionBridge.instance = new InteractionBridge();
    }
    return InteractionBridge.instance;
  }

  /**
   * Called by SceneRenderProfiler when a dashboard interaction starts
   *
   * @param interactionType - Type of interaction (existing SceneRenderProfiler constants)
   * @param source - Source component that triggered the interaction
   * @param context - Additional context data
   * @param startTime - Optional custom start time (if not provided, uses performance.now())
   */
  setCurrentInteraction(
    interactionType: string,
    source?: string,
    context?: Record<string, unknown>,
    startTime?: number
  ): void {
    // Check if there's already an active interaction (potential interruption)
    if (this.currentInteraction && this.isDebugEnabled()) {
      const interruptedDuration = performance.now() - (this.currentInteraction.startTime || 0);
      console.warn('[InteractionBridge] Interaction interrupted:', {
        interrupted: {
          type: this.currentInteraction.interactionType,
          id: this.currentInteraction.interactionId,
          source: this.currentInteraction.source,
          duration: interruptedDuration,
        },
        newInteraction: {
          type: interactionType,
          source: source || 'scene-render-profiler',
        },
      });
    }

    this.currentInteraction = {
      interactionType,
      interactionId: this.generateInteractionId(),
      source: source || 'scene-render-profiler',
      startTime: startTime ?? performance.now(),
      context: context || {},
    };

    // S4.0: Hierarchical debug logging when enabled
    if (this.isDebugEnabled() && this.currentInteraction) {
      const shortId = (this.currentInteraction.interactionId || '').slice(-8);
      console.log(
        `🔄 InteractionBridge: INTERACTION: ${interactionType.toUpperCase()}-${shortId} START`,
        this.currentInteraction
      );
    }
  }

  /**
   * Called by SceneRenderProfiler when dashboard interaction completes
   */
  clearCurrentInteraction(): void {
    if (this.isDebugEnabled() && this.currentInteraction) {
      const duration = performance.now() - (this.currentInteraction.startTime || 0);
      const shortId = (this.currentInteraction.interactionId || '').slice(-8);
      console.log(
        `└─ 🔄 InteractionBridge: ${(this.currentInteraction.interactionType || '').toUpperCase()}-${shortId} COMPLETED (${duration.toFixed(1)}ms total)`,
        {
          ...this.currentInteraction,
          duration,
        }
      );
    }

    this.currentInteraction = null;
  }

  /**
   * S4.0: Interrupt current interaction - logs the interruption and clears state
   * Used when a profile is cancelled while still recording trailing frames
   */
  interruptCurrentInteraction(): void {
    if (this.currentInteraction && this.isDebugEnabled()) {
      const interruptedDuration = performance.now() - (this.currentInteraction.startTime || 0);
      console.warn('[InteractionBridge] Interaction interrupted (cancelled):', {
        interrupted: {
          type: this.currentInteraction.interactionType,
          id: this.currentInteraction.interactionId,
          source: this.currentInteraction.source,
          duration: interruptedDuration,
        },
        reason: 'profile-cancelled',
      });
    }
    this.currentInteraction = null;
  }

  /**
   * Get current interaction type for backward compatibility
   * Used by existing code that only needs the interaction type
   */
  getCurrentInteractionType(): string | null {
    return this.currentInteraction?.interactionType || null;
  }

  /**
   * Get full correlation context for panel performance tracking
   * Used by VizPanelRenderProfiler to correlate panel metrics with dashboard interactions
   */
  getCorrelationContext(): CorrelationContext {
    return this.currentInteraction ? { ...this.currentInteraction } : {};
  }

  /**
   * Enhanced interaction start for future extensibility
   *
   * This method supports richer interaction tracking and will be expanded
   * in Phase 2 (sequences) and Phase 3 (user journeys)
   */
  startInteraction(
    interactionType: string,
    source: string,
    options?: {
      context?: Record<string, unknown>;
      // Future: sequenceType?, journeyType?, etc.
    }
  ): string {
    // Check for interruption before starting new interaction
    if (this.currentInteraction && this.isDebugEnabled()) {
      const interruptedDuration = performance.now() - (this.currentInteraction.startTime || 0);
      console.warn('[InteractionBridge] Enhanced interaction interrupted:', {
        interrupted: {
          type: this.currentInteraction.interactionType,
          id: this.currentInteraction.interactionId,
          source: this.currentInteraction.source,
          duration: interruptedDuration,
        },
        newInteraction: {
          type: interactionType,
          source: source,
        },
      });
    }

    const interactionId = this.generateInteractionId();

    this.currentInteraction = {
      interactionType,
      interactionId,
      source,
      startTime: performance.now(),
      context: options?.context || {},
    };

    if (this.isDebugEnabled()) {
      console.log('[InteractionBridge] Enhanced interaction started:', this.currentInteraction);
    }

    return interactionId;
  }

  /**
   * End current interaction
   */
  endInteraction(): void {
    this.clearCurrentInteraction();
  }

  /**
   * Generate unique interaction ID for correlation
   */
  private generateInteractionId(): string {
    return `int-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if render profiling debug logging is enabled
   * Uses dedicated flag: store.setObject('grafana.debug.renderProfiling', true)
   */
  private isDebugEnabled(): boolean {
    return store.getObject('grafana.debug.renderProfiling', false) === true;
  }

  /**
   * Get current interaction state for debugging
   */
  getCurrentState(): CorrelationContext | null {
    return this.currentInteraction ? { ...this.currentInteraction } : null;
  }
}

// Export singleton instance
export const interactionBridge = InteractionBridge.getInstance();
