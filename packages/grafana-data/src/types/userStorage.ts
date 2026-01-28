export interface UserStorage {
  /**
   * Retrieves an item from the backend user storage or local storage if not enabled.
   * @param key - The key of the item to retrieve.
   * @returns A promise that resolves to the item value or null if not found.
   */
  getItem(key: string): Promise<string | null>;
  /**
   * Sets an item in the backend user storage or local storage if not enabled.
   * If value is null, the item is deleted.
   * @param key - The key of the item to set.
   * @param value - The value of the item to set, or null to delete the item.
   * @returns A promise that resolves when the item is set or deleted.
   */
  setItem(key: string, value: string | null): Promise<void>;
  /**
   * Deletes an item from the backend user storage or local storage if not enabled.
   * @param key - The key of the item to delete.
   * @returns A promise that resolves when the item is deleted.
   */
  deleteItem(key: string): Promise<void>;
}
