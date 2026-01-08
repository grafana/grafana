export interface UserStorage {
  /**
   * Retrieves an item from the backend user storage or local storage if not enabled.
   * @param key - The key of the item to retrieve.
   * @returns A promise that resolves to the item value or null if not found.
   */
  getItem(key: string): Promise<string | null>;
  /**
   * Sets an item in the backend user storage or local storage if not enabled.
   * @param key - The key of the item to set.
   * @param value - The value of the item to set.
   * @returns A promise that resolves when the item is set.
   */
  setItem(key: string, value: string): Promise<void>;
}
