/** A 1-based, half-open text range, matching Monaco's `IRange` shape. */
export interface EditorRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

/**
 * Convert half-open character offsets `[from, to)` into `text` to a 1-based Monaco range.
 * Offsets are clamped to the text bounds, so out-of-range spans degrade gracefully.
 * Handles multi-line text (a query can wrap across lines in the editor).
 */
export function offsetsToRange(text: string, from: number, to: number): EditorRange {
  const start = clamp(Math.min(from, to), 0, text.length);
  const end = clamp(Math.max(from, to), 0, text.length);
  const startPos = positionAt(text, start);
  const endPos = positionAt(text, end);
  return {
    startLineNumber: startPos.line,
    startColumn: startPos.column,
    endLineNumber: endPos.line,
    endColumn: endPos.column,
  };
}

/** 1-based line/column for a character offset, counting `\n` as line breaks. */
function positionAt(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < offset; i++) {
    if (text[i] === '\n') {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, column: offset - lineStart + 1 };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
