/**
 * An Error that presents a custom, human-readable `message` while preserving the stack
 * trace of the original error (`cause`).
 *
 * Faro parses an exception's stack frames from the top-level error's `.stack`, and
 * serializes `.cause` only as a string (its message, not its stack). Wrapping with a plain
 * `new Error(message, { cause })` therefore reports the wrapper's shallow stack and drops the
 * original frames. Copying the cause's stack onto this error is what gets the real failure
 * location into telemetry under a descriptive title.
 */
export class TracedError extends Error {
  constructor(message: string, cause: unknown) {
    super(message, { cause });
    this.name = 'TracedError';

    if (cause instanceof Error && cause.stack) {
      this.stack = cause.stack;
    }
  }
}
