declare module 'clsx' {
  type ClassValue = string;
  /**
   * an optimized classnames function that only accepts strings as input, and returns a string as output.
   *
   * this is a deliberate, custom override of the clsx type definitions.
   * the `toVal` method in clsx is fast and simple, but is at its fastest and simplest when
   * processing only strings https://github.com/lukeed/clsx/blob/master/src/index.js#L1-L28
   *
   * if a more complex use case is warranted, we still have `cx` from Emotion we can use, so
   * adding this TypeScript shim on top of clsx forces us to use clsx only in its optimal case,
   * and we only want to use clsx for optimized code anyway.
   */
  function clsx(...inputs: ClassValue[]): string;
  export = clsx;
  export { clsx };
}
