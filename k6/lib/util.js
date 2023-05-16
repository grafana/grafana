import { randomString } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";

// Contains commonly used helper functions.

/**
 * Collection of randomization utility functions.
 */
export class rand {
  /**
   * Randomize a string.
   *
   * @returns {string} 15 characters of randomized alphanumeric characters.
   */
  static uid() {
    return randomString(15, "abcdefghijklmnopqrstuvxyz0123456789");
  }

  /**
   * Adds a number of randomized strings to an array.
   *
   * @param {string[]} list Array to append randomized strings to.
   * @param {number} num Number of randomized strings to append to the array.
   * @returns {string[]} Returns the provided list.
   */
  static strings(list, num) {
    for (let i = 0; i < num; i++) {
      list.push(randomString(15, "abcdefghijklmnopqrstuvxyz0123456789"));
    }
    return list;
  }

  /**
   * Returns a random item from the provided list.
   *
   * @param {any[]} li List of elements.
   * @returns {*} A random item from the list of elements, or null if the list is empty.
   */
  static select(li) {
    if (!li) return null;
    const i = Math.floor(Math.random() * li.length);
    return li[i];
  }

  /**
   * Returns a randomized slice (subset) for the provided list.
   *
   * @param {any[]} list Original list.
   * @param minLength Minimum length of the returned slice. Automatically capped to the length of the original list if larger.
   * @param maxLength Maximum length of the returned slice.
   * @returns {any[]} A randomized slice of the original list.
   */
  static slice(list, minLength, maxLength) {
    if (!list) return [];
    let sz = Math.floor(Math.random() * (maxLength-minLength));
    if (sz > list.length) {
      sz = list.length;
    }
    const i = Math.floor(Math.random() * (list.length - sz));
    return list.slice(i, i+sz);
  }
}
