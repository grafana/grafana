/**
 * Last-Write-Wins Register (LWW-Register) CRDT implementation
 *
 * A register that stores a single value and resolves conflicts using timestamps.
 * When concurrent updates occur, the one with the highest timestamp wins.
 *
 * Properties:
 * - Deterministic conflict resolution via timestamp ordering
 * - Idempotent: setting same value with same timestamp is safe
 * - Commutative: can apply updates in any order, final state is consistent
 *
 * Used for panel properties: position, dimensions, exploreState, etc.
 */

import { HLCTimestamp, compareHLC } from './hlc';

export interface LWWRegisterJSON<T> {
  value: T;
  timestamp: HLCTimestamp;
}

export class LWWRegister<T> {
  private value: T;
  private timestamp: HLCTimestamp;

  /**
   * Create a new LWW-Register with an initial value and timestamp
   *
   * @param initialValue - The initial value
   * @param initialTimestamp - The initial timestamp
   */
  constructor(initialValue: T, initialTimestamp: HLCTimestamp) {
    this.value = initialValue;
    this.timestamp = initialTimestamp;
  }

  /**
   * Set the register value if the new timestamp is greater than current
   *
   * @param value - The new value
   * @param timestamp - The timestamp of this update
   * @returns true if the value was updated, false if update was ignored
   */
  set(value: T, timestamp: HLCTimestamp): boolean {
    // Only update if new timestamp is strictly greater
    if (compareHLC(timestamp, this.timestamp) > 0) {
      this.value = value;
      this.timestamp = timestamp;
      return true;
    }
    return false;
  }

  /**
   * Get the current value
   */
  get(): T {
    return this.value;
  }

  /**
   * Get the current timestamp
   */
  getTimestamp(): HLCTimestamp {
    return this.timestamp;
  }

  /**
   * Merge another LWW-Register into this one
   * Keeps the value with the highest timestamp
   *
   * @param other - The register to merge
   * @returns true if this register's value was updated
   */
  merge(other: LWWRegister<T>): boolean {
    return this.set(other.value, other.timestamp);
  }

  /**
   * Create a copy of this register
   */
  clone(): LWWRegister<T> {
    return new LWWRegister(this.value, { ...this.timestamp });
  }

  /**
   * Serialize to JSON
   */
  toJSON(): LWWRegisterJSON<T> {
    return {
      value: this.value,
      timestamp: this.timestamp,
    };
  }

  /**
   * Deserialize from JSON
   */
  static fromJSON<T>(json: LWWRegisterJSON<T>): LWWRegister<T> {
    return new LWWRegister(json.value, json.timestamp);
  }

  /**
   * Get debug information
   */
  debug(): {
    value: T;
    timestamp: HLCTimestamp;
  } {
    return {
      value: this.value,
      timestamp: this.timestamp,
    };
  }
}

/**
 * Helper function to create a register with a zero timestamp
 * Useful for initialization
 */
export function createLWWRegister<T>(value: T, nodeId: string): LWWRegister<T> {
  return new LWWRegister(value, {
    logicalTime: 0,
    wallTime: 0,
    nodeId,
  });
}
