/**
 * Hybrid Logical Clock (HLC) implementation
 *
 * Combines logical time (Lamport timestamp) with physical wall-clock time
 * to provide timestamps that are:
 * - Monotonically increasing
 * - Causally consistent
 * - Approximately synchronized with real time
 *
 * Used for conflict resolution in LWW-Register CRDTs.
 */

export interface HLCTimestamp {
  logicalTime: number;  // Lamport timestamp component
  wallTime: number;     // Physical clock component (milliseconds since epoch)
  nodeId: string;       // Unique node identifier for tie-breaking
}

export class HybridLogicalClock {
  private logicalTime: number = 0;
  private lastWallTime: number = 0;
  private nodeId: string;

  constructor(nodeId: string) {
    this.nodeId = nodeId;
    this.lastWallTime = Date.now();
  }

  /**
   * Advance the clock for a local event
   * Returns a new timestamp representing "now"
   */
  tick(): HLCTimestamp {
    const now = Date.now();

    if (now > this.lastWallTime) {
      // Physical clock advanced - use it
      this.lastWallTime = now;
      this.logicalTime = 0;
    } else {
      // Physical clock hasn't advanced - increment logical component
      this.logicalTime++;
    }

    return this.clone();
  }

  /**
   * Update clock based on received timestamp from another node
   * Ensures causal consistency: if A → B, then timestamp(A) < timestamp(B)
   */
  update(receivedTimestamp: HLCTimestamp): void {
    const now = Date.now();
    const maxWall = Math.max(this.lastWallTime, receivedTimestamp.wallTime, now);

    if (maxWall === this.lastWallTime && maxWall === receivedTimestamp.wallTime) {
      // Same wall time - take max logical time and increment
      this.logicalTime = Math.max(this.logicalTime, receivedTimestamp.logicalTime) + 1;
    } else if (maxWall === receivedTimestamp.wallTime) {
      // Received timestamp has newer wall time
      this.lastWallTime = maxWall;
      this.logicalTime = receivedTimestamp.logicalTime + 1;
    } else {
      // Our wall time or physical clock is newer
      this.lastWallTime = maxWall;
      this.logicalTime = 0;
    }
  }

  /**
   * Get current timestamp without advancing the clock
   */
  now(): HLCTimestamp {
    return this.clone();
  }

  /**
   * Create a copy of the current timestamp
   */
  clone(): HLCTimestamp {
    return {
      logicalTime: this.logicalTime,
      wallTime: this.lastWallTime,
      nodeId: this.nodeId,
    };
  }

  /**
   * Get the node ID
   */
  getNodeId(): string {
    return this.nodeId;
  }
}

/**
 * Compare two HLC timestamps
 * Returns:
 *   < 0 if a < b
 *   > 0 if a > b
 *   = 0 if a == b
 */
export function compareHLC(a: HLCTimestamp, b: HLCTimestamp): number {
  // First compare wall time
  if (a.wallTime !== b.wallTime) {
    return a.wallTime - b.wallTime;
  }

  // Then compare logical time
  if (a.logicalTime !== b.logicalTime) {
    return a.logicalTime - b.logicalTime;
  }

  // Finally compare node IDs for deterministic tie-breaking
  return a.nodeId.localeCompare(b.nodeId);
}

/**
 * Check if timestamp a happened before timestamp b
 */
export function happensBefore(a: HLCTimestamp, b: HLCTimestamp): boolean {
  return compareHLC(a, b) < 0;
}

/**
 * Check if timestamp a happened after timestamp b
 */
export function happensAfter(a: HLCTimestamp, b: HLCTimestamp): boolean {
  return compareHLC(a, b) > 0;
}

/**
 * Check if two timestamps are equal
 */
export function timestampEquals(a: HLCTimestamp, b: HLCTimestamp): boolean {
  return compareHLC(a, b) === 0;
}

/**
 * Get the maximum of two timestamps
 */
export function maxTimestamp(a: HLCTimestamp, b: HLCTimestamp): HLCTimestamp {
  return compareHLC(a, b) >= 0 ? a : b;
}

/**
 * Serialize timestamp to JSON
 */
export function serializeHLC(timestamp: HLCTimestamp): string {
  return JSON.stringify(timestamp);
}

/**
 * Deserialize timestamp from JSON
 */
export function deserializeHLC(json: string): HLCTimestamp {
  return JSON.parse(json);
}
