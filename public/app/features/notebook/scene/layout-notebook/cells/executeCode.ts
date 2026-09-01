// Runs a code cell in the browser and captures what it produced, so a notebook can be read as a live
// document rather than a static snippet — the same idea as a Jupyter cell.
//
// Proof-of-concept scope: JavaScript (and TypeScript that happens to be valid JavaScript) runs on the
// main thread via a sandboxed console and a direct `eval`. It is deliberately not a security boundary
// — the code has the same reach as anything else on the page — so it only ever runs code the reader
// themselves typed and explicitly pressed Run on, exactly like a browser devtools console.

type CodeExecutionLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

interface CodeExecutionLog {
  level: CodeExecutionLevel;
  /** The console arguments, already formatted and joined the way the browser console would show them. */
  text: string;
}

export interface CodeExecutionResult {
  logs: CodeExecutionLog[];
  /**
   * The value of the cell's last expression, formatted for display — the REPL-style result a reader
   * expects to see under a cell. Absent when the cell evaluated to `undefined` (a `console.log`, a
   * loop, an assignment), so a bare `undefined` line does not follow every run.
   */
  value?: string;
  /** Present instead of `value` when the code threw or failed to parse. */
  error?: string;
  durationMs: number;
}

// `AsyncFunction` is not a global, but every async function shares one constructor. Going through it
// lets a cell use `await` on a trailing promise (e.g. `fetch(...)`) and have the result awaited before
// it is shown, without the cell author writing any boilerplate. `getPrototypeOf` is typed `any`, so
// the annotation narrows it here without a type assertion.
const AsyncFunction: new (...args: string[]) => (...args: unknown[]) => Promise<unknown> = Object.getPrototypeOf(
  async () => {}
).constructor;

/**
 * Formats a value the way a browser console would: strings as themselves (not quoted), objects as
 * pretty JSON, and everything the JSON serializer cannot take — functions, symbols, bigints, circular
 * objects — via its own string form rather than as an empty `{}` or a thrown error.
 */
export function formatValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (value === undefined) {
    return 'undefined';
  }

  if (value === null) {
    return 'null';
  }

  if (value instanceof Error) {
    return formatError(value);
  }

  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint' ||
    typeof value === 'symbol' ||
    typeof value === 'function'
  ) {
    return String(value);
  }

  try {
    // A `bigint` nested inside an object still throws here; the catch below is what covers it, along
    // with circular references.
    return JSON.stringify(value, replaceUnserializable, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

// Values JSON.stringify would otherwise drop silently (functions, undefined) or throw on (bigint),
// rendered as a readable token instead so a logged object keeps all of its keys.
function replaceUnserializable(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') {
    return `${value}n`;
  }

  if (typeof value === 'function') {
    return `[Function: ${value.name || 'anonymous'}]`;
  }

  if (typeof value === 'undefined') {
    return '[undefined]';
  }

  return value;
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return formatValue(error);
}

/**
 * Evaluates a code cell and returns its console output and result value, or the error it produced.
 * Never rejects: a syntax error, a runtime throw, or a rejected trailing promise all come back as
 * `error` on the result, because a cell failing to run is an outcome to show, not an exception the
 * caller has to guard.
 */
export async function executeCode(code: string): Promise<CodeExecutionResult> {
  const logs: CodeExecutionLog[] = [];
  const capture =
    (level: CodeExecutionLevel) =>
    (...args: unknown[]) =>
      logs.push({ level, text: args.map(formatValue).join(' ') });

  // A console the cell can log to without touching the real one, so a run's output lands under the
  // cell instead of in devtools.
  const sandboxConsole = {
    log: capture('log'),
    info: capture('info'),
    warn: capture('warn'),
    error: capture('error'),
    debug: capture('debug'),
  };

  const start = performance.now();

  try {
    // A direct `eval` (called by that exact name) evaluates the source in this function's scope, so
    // the cell's `console` resolves to the sandbox above, and its completion value — the value of its
    // last expression — is what `eval` returns. That is what makes a trailing `1 + 1` show `2` the way
    // a REPL does. Awaited so a trailing promise resolves to its value before being shown.
    const runner = new AsyncFunction('console', '__notebookSource', 'return await eval(__notebookSource);');
    const value = await runner(sandboxConsole, code);

    return {
      logs,
      value: value === undefined ? undefined : formatValue(value),
      durationMs: performance.now() - start,
    };
  } catch (error) {
    return {
      logs,
      error: formatError(error),
      durationMs: performance.now() - start,
    };
  }
}
