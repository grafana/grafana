/**
 * Positive-Negative Counter (PN-Counter) CRDT implementation
 *
 * A counter that supports both increment and decrement operations.
 * Each node maintains separate positive and negative counters.
 *
 * Properties:
 * - Commutative: operations can be applied in any order
 * - Idempotent: applying same operation multiple times (with dedup) is safe
 * - Eventually consistent: all replicas converge to same value
 *
 * Used for allocating monotonically increasing z-indices.
 * For our use case, we only need increments (positive counter).
 */

export interface PNCounterJSON {
  increments: Record<string, number>;  // nodeId -> count
  decrements: Record<string, number>;  // nodeId -> count
}

export class PNCounter {
  private increments: Map<string, number>;  // nodeId -> count
  private decrements: Map<string, number>;  // nodeId -> count

  constructor() {
    this.increments = new Map();
    this.decrements = new Map();
  }

  /**
   * Increment the counter for a specific node
   *
   * @param nodeId - The node performing the increment
   * @param delta - The amount to increment (default: 1)
   */
  increment(nodeId: string, delta: number = 1): void {
    if (delta < 0) {
      throw new Error('Delta must be non-negative for increment');
    }
    const current = this.increments.get(nodeId) || 0;
    this.increments.set(nodeId, current + delta);
  }

  /**
   * Decrement the counter for a specific node
   *
   * @param nodeId - The node performing the decrement
   * @param delta - The amount to decrement (default: 1)
   */
  decrement(nodeId: string, delta: number = 1): void {
    if (delta < 0) {
      throw new Error('Delta must be non-negative for decrement');
    }
    const current = this.decrements.get(nodeId) || 0;
    this.decrements.set(nodeId, current + delta);
  }

  /**
   * Get the current value of the counter
   * Value = sum of all increments - sum of all decrements
   */
  value(): number {
    let sum = 0;

    // Add all increments
    for (const count of this.increments.values()) {
      sum += count;
    }

    // Subtract all decrements
    for (const count of this.decrements.values()) {
      sum -= count;
    }

    return sum;
  }

  /**
   * Get the next value and increment the counter for a node
   * This is useful for allocating sequential IDs (like z-indices)
   *
   * @param nodeId - The node allocating the next value
   * @returns The next available value
   */
  next(nodeId: string): number {
    const nextValue = this.value() + 1;
    this.increment(nodeId, 1);
    return nextValue;
  }

  /**
   * Merge another PN-Counter into this one
   * Takes the maximum value for each node's counters
   *
   * @param other - The counter to merge
   */
  merge(other: PNCounter): this {
    // Merge increments (take max for each node)
    for (const [nodeId, count] of other.increments.entries()) {
      const current = this.increments.get(nodeId) || 0;
      this.increments.set(nodeId, Math.max(current, count));
    }

    // Merge decrements (take max for each node)
    for (const [nodeId, count] of other.decrements.entries()) {
      const current = this.decrements.get(nodeId) || 0;
      this.decrements.set(nodeId, Math.max(current, count));
    }

    return this;
  }

  /**
   * Create a copy of this counter
   */
  clone(): PNCounter {
    const copy = new PNCounter();
    copy.increments = new Map(this.increments);
    copy.decrements = new Map(this.decrements);
    return copy;
  }

  /**
   * Reset the counter to zero (for testing)
   */
  reset(): void {
    this.increments.clear();
    this.decrements.clear();
  }

  /**
   * Serialize to JSON
   */
  toJSON(): PNCounterJSON {
    return {
      increments: Object.fromEntries(this.increments),
      decrements: Object.fromEntries(this.decrements),
    };
  }

  /**
   * Deserialize from JSON
   */
  static fromJSON(json: PNCounterJSON): PNCounter {
    const counter = new PNCounter();
    counter.increments = new Map(Object.entries(json.increments));
    counter.decrements = new Map(Object.entries(json.decrements));
    return counter;
  }

  /**
   * Get debug information
   */
  debug(): {
    value: number;
    increments: Record<string, number>;
    decrements: Record<string, number>;
    nodeCount: number;
  } {
    return {
      value: this.value(),
      increments: Object.fromEntries(this.increments),
      decrements: Object.fromEntries(this.decrements),
      nodeCount: new Set([...this.increments.keys(), ...this.decrements.keys()]).size,
    };
  }
}
