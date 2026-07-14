// Cursor-aware PromQL insertion helpers. Pure, unit-testable.
// Scope: prototype only — good enough for demos, not a real PromQL parser.

export interface InsertionInput {
  text: string;
  cursor: number; // char offset
}

export interface InsertionResult {
  text: string;
  cursor: number; // new cursor position after insertion
}

export type InsertionChoice = 'overwrite' | 'newQuery' | 'splitView';

export interface AmbiguousInsertion {
  needsChoice: true;
  reason: string;
  options: InsertionChoice[];
  // Preview strings the UI can show for each option, and the string that
  // handlers should use when dispatching (overwrite → replace editor with X;
  // newQuery → create a new pane-local query with X as its expr; splitView →
  // open a new pane whose sole query has X as its expr).
  previews: Partial<Record<InsertionChoice, string>>;
}

export type MaybeAmbiguous = InsertionResult | AmbiguousInsertion;

export function isAmbiguous(r: MaybeAmbiguous): r is AmbiguousInsertion {
  return (r as AmbiguousInsertion).needsChoice === true;
}

// Insert or replace metric name at position 0 when the query is empty; otherwise ambiguous.
export function insertMetric(metric: string, input: InsertionInput): MaybeAmbiguous {
  const trimmed = input.text.trim();
  if (trimmed.length === 0) {
    return { text: metric, cursor: metric.length };
  }
  // If the text is exactly a single bare identifier (no braces, functions, operators),
  // treat clicking a new metric as a replace — that's the common "I typed a couple letters" case.
  if (/^[a-zA-Z_:][a-zA-Z0-9_:]*$/.test(trimmed)) {
    return { text: metric, cursor: metric.length };
  }
  return {
    needsChoice: true,
    reason: 'A metric is already being queried',
    options: ['overwrite', 'newQuery', 'splitView'],
    previews: {
      overwrite: metric,
      newQuery: metric,
      splitView: metric,
    },
  };
}

// Locate the {...} selector that contains the cursor. Returns null if cursor isn't inside one.
// Counts unescaped braces; ignores content inside string literals.
export function findEnclosingSelector(text: string, cursor: number): { openBrace: number; closeBrace: number } | null {
  let openBrace = -1;
  let inString = false;
  let stringChar: '"' | "'" | '`' | null = null;
  for (let i = 0; i < cursor; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === stringChar) {
        inString = false;
        stringChar = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      stringChar = ch as '"' | "'" | '`';
      continue;
    }
    if (ch === '{') {
      openBrace = i;
    } else if (ch === '}') {
      openBrace = -1;
    }
  }
  if (openBrace === -1) {
    return null;
  }
  // Find the matching close brace at or after cursor.
  inString = false;
  stringChar = null;
  for (let i = cursor; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === stringChar) {
        inString = false;
        stringChar = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      stringChar = ch as '"' | "'" | '`';
      continue;
    }
    if (ch === '}') {
      return { openBrace, closeBrace: i };
    }
  }
  return null;
}

// True when the editor has more than one metric expression, a function call, or a binary operator —
// meaning "insert this label into {...}" is ambiguous even if the cursor happens to be inside braces.
export function hasAmbiguousStructure(text: string): boolean {
  // strip string literals to avoid false positives
  const noStrings = text.replace(/"([^"\\]|\\.)*"/g, '""').replace(/'([^'\\]|\\.)*'/g, "''");
  const braceGroups = (noStrings.match(/\{/g) || []).length;
  const hasFunction = /[a-zA-Z_:][a-zA-Z0-9_:]*\s*\(/.test(noStrings);
  const hasBinaryOp = /\s(?:\+|-|\*|\/|%|\^|==|!=|>=|<=|>|<|and|or|unless)\s/.test(noStrings);
  return braceGroups > 1 || hasFunction || hasBinaryOp;
}

// Locate the first {...} selector in the text (from left). Used when the cursor
// isn't inside one but the text still has one — a common state after the user
// clicks metrics/labels from the tree without touching the editor.
function findFirstSelectorInText(text: string): { openBrace: number; closeBrace: number } | null {
  let openBrace = -1;
  let inString = false;
  let stringChar: '"' | "'" | '`' | null = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === stringChar) {
        inString = false;
        stringChar = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      stringChar = ch as '"' | "'" | '`';
      continue;
    }
    if (ch === '{' && openBrace === -1) {
      openBrace = i;
    } else if (ch === '}' && openBrace !== -1) {
      return { openBrace, closeBrace: i };
    }
  }
  return null;
}

// Build the label="value" insertion into an existing selector, with correct
// comma handling at the given position. Extracted so both cursor-in-selector
// and metric-has-selector paths reuse it.
function insertIntoSelector(
  text: string,
  selector: { openBrace: number; closeBrace: number },
  insertAt: number,
  snippet: string
): InsertionResult {
  const inner = text.slice(selector.openBrace + 1, selector.closeBrace);
  const innerHasContent = inner.trim().length > 0;
  const charBefore = text[insertAt - 1];
  const charAt = text[insertAt];
  const needsLeadingComma = innerHasContent && charBefore !== '{' && charBefore !== ',' && charBefore !== ' ';
  const needsTrailingComma =
    innerHasContent && charAt !== '}' && charAt !== ',' && charAt !== ' ' && insertAt < selector.closeBrace;
  const prefix = needsLeadingComma ? ', ' : '';
  const suffix = needsTrailingComma ? ', ' : '';
  const toInsert = `${prefix}${snippet}${suffix}`;
  const nextText = text.slice(0, insertAt) + toInsert + text.slice(insertAt);
  return { text: nextText, cursor: insertAt + toInsert.length };
}

// Insert an arbitrary `key<op>value` matcher snippet at the right place given
// current text/cursor. Powers all of insertLabelValueAtCursor / …Exclusion /
// insertLabelPresence / insertLabelAbsence. Handles the common tree-driven flows
// without punting to a menu:
//   - Empty text                → produce `{snippet}`
//   - Bare metric name          → append `{snippet}` to it
//   - Metric with existing {…}  → insert into the (single) selector, comma-aware
//   - Cursor inside a selector  → insert at cursor, comma-aware
// Falls back to the ambiguous menu only for truly weird states (multiple
// selectors, function calls with cursor outside braces, etc.).
function insertMatcherAtCursor(snippet: string, input: InsertionInput): MaybeAmbiguous {
  // Case: empty editor — build a bare selector.
  if (input.text.trim().length === 0) {
    const built = `{${snippet}}`;
    return { text: built, cursor: built.length };
  }

  // Case: cursor is inside a selector. Insert at cursor, unless the surrounding
  // structure is genuinely ambiguous (multi-selector / function / operator).
  const enclosing = findEnclosingSelector(input.text, input.cursor);
  if (enclosing && !hasAmbiguousStructure(input.text)) {
    return insertIntoSelector(input.text, enclosing, input.cursor, snippet);
  }

  // Case: cursor isn't in a selector but the text is a bare metric name.
  // Append `{label="value"}` to it. Common after clicking a metric in the tree.
  const bareMetricMatch = input.text.trim().match(/^[a-zA-Z_:][a-zA-Z0-9_:]*$/);
  if (bareMetricMatch) {
    const trimmed = input.text.trimEnd();
    const next = `${trimmed}{${snippet}}`;
    return { text: next, cursor: next.length };
  }

  // Case: text has a single {…} selector somewhere but cursor isn't in it.
  // Insert into the existing selector (before its `}`) rather than adding a new one.
  const firstSelector = findFirstSelectorInText(input.text);
  if (firstSelector && !hasAmbiguousStructure(input.text)) {
    return insertIntoSelector(input.text, firstSelector, firstSelector.closeBrace, snippet);
  }

  if (enclosing) {
    return {
      needsChoice: true,
      reason: 'A query is already in progress',
      options: ['overwrite', 'newQuery', 'splitView'],
      previews: {
        overwrite: `{${snippet}}`,
        newQuery: `{${snippet}}`,
        splitView: `{${snippet}}`,
      },
    };
  }
  return {
    needsChoice: true,
    reason: 'A query is already in progress',
    options: ['overwrite', 'newQuery', 'splitView'],
    previews: {
      overwrite: `{${snippet}}`,
      newQuery: `{${snippet}}`,
      splitView: `{${snippet}}`,
    },
  };
}

// Public wrappers for the four matcher shapes the tree UI needs.
export function insertLabelValueAtCursor(label: string, value: string, input: InsertionInput): MaybeAmbiguous {
  return insertMatcherAtCursor(`${label}="${value}"`, input);
}
export function insertLabelValueExclusion(label: string, value: string, input: InsertionInput): MaybeAmbiguous {
  return insertMatcherAtCursor(`${label}!="${value}"`, input);
}
// "Add this label to the query without a specific value" — matches series where
// the label is present (non-empty). Useful when the user knows they care about
// a label but hasn't chosen a value yet.
export function insertLabelPresence(label: string, input: InsertionInput): MaybeAmbiguous {
  return insertMatcherAtCursor(`${label}!=""`, input);
}
// "Exclude this label from the query" — matches series where the label is
// absent (empty). The mirror of insertLabelPresence.
export function insertLabelAbsence(label: string, input: InsertionInput): MaybeAmbiguous {
  return insertMatcherAtCursor(`${label}=""`, input);
}

// Extract already-applied filters from the first selector in the text. Used for the
// live "~N series match" badge estimate. Very forgiving parser.
export function parseFilters(text: string): {
  metric: string | null;
  filters: Array<{ label: string; value: string }>;
} {
  const metricMatch = text.match(/([a-zA-Z_:][a-zA-Z0-9_:]*)\s*\{/);
  const bareMetric = text.match(/^\s*([a-zA-Z_:][a-zA-Z0-9_:]*)\s*$/);
  const metric = metricMatch?.[1] ?? bareMetric?.[1] ?? null;
  const filters: Array<{ label: string; value: string }> = [];
  const selectorMatch = text.match(/\{([^}]*)\}/);
  if (selectorMatch) {
    const body = selectorMatch[1];
    // Match `key="value"`. Only equality — that's all our mock estimator handles.
    const filterRe = /([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*"([^"]*)"/g;
    let m: RegExpExecArray | null;
    while ((m = filterRe.exec(body)) !== null) {
      filters.push({ label: m[1], value: m[2] });
    }
  }
  return { metric, filters };
}

// Best-effort: extract the identifier token immediately before/at the cursor,
// used to filter the metric tree as the user types.
export function currentIdentifierAtCursor(text: string, cursor: number): string {
  let start = cursor;
  while (start > 0 && /[a-zA-Z0-9_:]/.test(text[start - 1])) {
    start--;
  }
  let end = cursor;
  while (end < text.length && /[a-zA-Z0-9_:]/.test(text[end])) {
    end++;
  }
  return text.slice(start, end);
}
