/**
 * Observed-Remove Set (OR-Set) CRDT implementation
 *
 * A set that handles concurrent add/remove operations correctly.
 * Each element is tagged with unique identifiers, and removes only
 * affect the specific tags they observed.
 *
 * Properties:
 * - Add-wins semantics: concurrent add/remove results in element being present
 * - Idempotent operations: applying same operation multiple times is safe
 * - Commutative: operations can be applied in any order
 *
 * Used for tracking which panels exist on the canvas.
 */

export interface ORSetJSON<T> {
  adds: Record<string, string[]>;  // element -> array of unique tags
  removes: string[];                // array of removed tags
}

export class ORSet<T extends string = string> {
  private adds: Map<T, Set<string>>;  // element -> set of unique tags
  private removes: Set<string>;        // set of removed tags

  constructor() {
    this.adds = new Map();
    this.removes = new Set();
  }

  /**
   * Add an element to the set with a unique tag
   * The tag should be globally unique (e.g., operation ID)
   *
   * @param element - The element to add
   * @param tag - Unique identifier for this add operation
   */
  add(element: T, tag: string): void {
    if (!this.adds.has(element)) {
      this.adds.set(element, new Set());
    }
    this.adds.get(element)!.add(tag);
  }

  /**
   * Remove an element from the set
   * Only removes the specific tags that were observed
   *
   * @param element - The element to remove
   * @param observedTags - The tags that were observed when the remove was issued
   */
  remove(element: T, observedTags: string[]): void {
    for (const tag of observedTags) {
      this.removes.add(tag);
    }

    // Clean up the element's tags
    const elementTags = this.adds.get(element);
    if (elementTags) {
      for (const tag of observedTags) {
        elementTags.delete(tag);
      }

      // If no tags remain, remove the element entry
      if (elementTags.size === 0) {
        this.adds.delete(element);
      }
    }
  }

  /**
   * Check if an element is in the set
   * Element is present if it has at least one non-removed tag
   *
   * @param element - The element to check
   * @returns true if element is in the set
   */
  contains(element: T): boolean {
    const tags = this.adds.get(element);
    if (!tags || tags.size === 0) {
      return false;
    }

    // Element is present if it has at least one tag that hasn't been removed
    for (const tag of tags) {
      if (!this.removes.has(tag)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get all tags for an element (including removed ones)
   *
   * @param element - The element to get tags for
   * @returns Array of tags, or empty array if element not found
   */
  getTags(element: T): string[] {
    const tags = this.adds.get(element);
    return tags ? Array.from(tags) : [];
  }

  /**
   * Get all elements currently in the set
   *
   * @returns Array of elements
   */
  values(): T[] {
    const result: T[] = [];
    for (const [element, tags] of this.adds.entries()) {
      // Include element if it has at least one non-removed tag
      for (const tag of tags) {
        if (!this.removes.has(tag)) {
          result.push(element);
          break;
        }
      }
    }
    return result;
  }

  /**
   * Get the number of elements in the set
   */
  size(): number {
    return this.values().length;
  }

  /**
   * Check if the set is empty
   */
  isEmpty(): boolean {
    return this.size() === 0;
  }

  /**
   * Merge another OR-Set into this one
   * Takes the union of all adds and removes
   *
   * @param other - The OR-Set to merge
   * @returns This OR-Set (for chaining)
   */
  merge(other: ORSet<T>): this {
    // Merge adds (union of all tags)
    for (const [element, otherTags] of other.adds.entries()) {
      if (!this.adds.has(element)) {
        this.adds.set(element, new Set());
      }
      const myTags = this.adds.get(element)!;
      for (const tag of otherTags) {
        myTags.add(tag);
      }
    }

    // Merge removes (union of all removed tags)
    for (const tag of other.removes) {
      this.removes.add(tag);
    }

    // Clean up elements with all tags removed
    for (const [element, tags] of this.adds.entries()) {
      let hasLiveTag = false;
      for (const tag of tags) {
        if (!this.removes.has(tag)) {
          hasLiveTag = true;
          break;
        }
      }
      if (!hasLiveTag) {
        this.adds.delete(element);
      }
    }

    return this;
  }

  /**
   * Create a copy of this OR-Set
   */
  clone(): ORSet<T> {
    const copy = new ORSet<T>();

    // Deep copy adds
    for (const [element, tags] of this.adds.entries()) {
      copy.adds.set(element, new Set(tags));
    }

    // Deep copy removes
    copy.removes = new Set(this.removes);

    return copy;
  }

  /**
   * Clear all elements from the set (for testing/reset)
   */
  clear(): void {
    this.adds.clear();
    this.removes.clear();
  }

  /**
   * Serialize to JSON for network transmission or storage
   */
  toJSON(): ORSetJSON<T> {
    const adds: Record<string, string[]> = {};
    for (const [element, tags] of this.adds.entries()) {
      adds[element] = Array.from(tags);
    }

    return {
      adds,
      removes: Array.from(this.removes),
    };
  }

  /**
   * Deserialize from JSON
   */
  static fromJSON<T extends string = string>(json: ORSetJSON<T>): ORSet<T> {
    const set = new ORSet<T>();

    // Restore adds
    for (const [element, tags] of Object.entries(json.adds)) {
      set.adds.set(element as T, new Set(tags));
    }

    // Restore removes
    set.removes = new Set(json.removes);

    return set;
  }

  /**
   * Get debug information about the set
   */
  debug(): {
    elements: T[];
    totalTags: number;
    removedTags: number;
    rawAdds: Map<T, Set<string>>;
    rawRemoves: Set<string>;
  } {
    let totalTags = 0;
    for (const tags of this.adds.values()) {
      totalTags += tags.size;
    }

    return {
      elements: this.values(),
      totalTags,
      removedTags: this.removes.size,
      rawAdds: this.adds,
      rawRemoves: this.removes,
    };
  }
}
