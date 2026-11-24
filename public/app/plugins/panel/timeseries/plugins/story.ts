import {
  type DataFrame,
  type Field,
  FieldColorModeId,
  FieldType,
  getDisplayProcessor,
  getFieldDisplayName,
  type GrafanaTheme2,
} from '@grafana/data';
import { type GraphFieldConfig } from '@grafana/schema';

export const SUBJECT_MIN_LINE_WIDTH = 2.5;
export const CONTEXT_LINE_WIDTH = 1.25;
export const ANNOTATION_LABEL_MAX_CHARS = 40;

const NO_SUBJECTS: ReadonlySet<string> = new Set();
const REGEX_PATTERN = /^\/(.+)\/([a-z]*)$/;

export interface StoryColors {
  subject: string;
  context: string;
}

export interface StoryHighlightResult {
  frames: DataFrame[];
  /** Display names of the highlighted series; empty when nothing is highlighted. */
  subjects: ReadonlySet<string>;
}

function parseRegex(highlight: string): RegExp | undefined {
  const match = REGEX_PATTERN.exec(highlight);
  if (!match) {
    return undefined;
  }
  try {
    // global and sticky flags make `test` stateful, which would skip matches across names
    return new RegExp(match[1], match[2].replace(/[gy]/g, ''));
  } catch {
    return undefined;
  }
}

/**
 * Picks the subject series. `/pattern/flags` is a regex; anything else is a case-insensitive exact
 * match on the display name, falling back to substring when no name matches exactly.
 */
export function findSubjectNames(names: string[], highlight: string | undefined): ReadonlySet<string> {
  const query = highlight?.trim();
  if (!query) {
    return NO_SUBJECTS;
  }

  const regex = parseRegex(query);
  if (regex) {
    return new Set(names.filter((name) => regex.test(name)));
  }

  const lower = query.toLowerCase();
  const exact = names.filter((name) => name.toLowerCase() === lower);
  if (exact.length) {
    return new Set(exact);
  }
  return new Set(names.filter((name) => name.toLowerCase().includes(lower)));
}

function restyleField(field: Field, isSubject: boolean, colors: StoryColors, theme: GrafanaTheme2): Field {
  const custom: GraphFieldConfig = field.config.custom ?? {};
  const copy: Field = {
    ...field,
    config: {
      ...field.config,
      color: { mode: FieldColorModeId.Fixed, fixedColor: isSubject ? colors.subject : colors.context },
      custom: isSubject
        ? { ...custom, lineColor: undefined, lineWidth: Math.max(custom.lineWidth ?? 1, SUBJECT_MIN_LINE_WIDTH) }
        : { ...custom, lineColor: undefined, lineWidth: CONTEXT_LINE_WIDTH, fillOpacity: 0 },
    },
  };
  copy.display = getDisplayProcessor({ field: copy, theme });
  return copy;
}

/**
 * Restyles graphable frames so the highlighted series stand out and every other series recedes.
 * Subject fields and the frames holding them move last, because uPlot paints series in order and the
 * subject must sit on top. Returns the input untouched when nothing matches.
 */
export function applyStoryHighlight(
  frames: DataFrame[],
  highlight: string | undefined,
  colors: StoryColors,
  theme: GrafanaTheme2
): StoryHighlightResult {
  if (!highlight?.trim()) {
    return { frames, subjects: NO_SUBJECTS };
  }

  const names: string[] = [];
  for (const frame of frames) {
    for (const field of frame.fields) {
      if (field.type === FieldType.number) {
        names.push(getFieldDisplayName(field, frame, frames));
      }
    }
  }

  const subjects = findSubjectNames(names, highlight);
  if (!subjects.size) {
    return { frames, subjects: NO_SUBJECTS };
  }

  const contextFrames: DataFrame[] = [];
  const subjectFrames: DataFrame[] = [];

  for (const frame of frames) {
    const contextFields: Field[] = [];
    const subjectFields: Field[] = [];

    for (const field of frame.fields) {
      if (field.type !== FieldType.number) {
        contextFields.push(field);
        continue;
      }
      const isSubject = subjects.has(getFieldDisplayName(field, frame, frames));
      (isSubject ? subjectFields : contextFields).push(restyleField(field, isSubject, colors, theme));
    }

    const restyled = { ...frame, fields: [...contextFields, ...subjectFields] };
    (subjectFields.length ? subjectFrames : contextFrames).push(restyled);
  }

  return { frames: [...contextFrames, ...subjectFrames], subjects };
}

/**
 * Index of the last non-null value whose x lies within [min, max], or -1. Expects ascending xs.
 */
export function findLastIndexInRange(
  xs: ArrayLike<number>,
  ys: ArrayLike<number | null | undefined>,
  min: number,
  max: number
): number {
  for (let i = Math.min(xs.length, ys.length) - 1; i >= 0; i--) {
    const x = xs[i];
    if (x > max) {
      continue;
    }
    if (x < min) {
      return -1;
    }
    if (ys[i] != null) {
      return i;
    }
  }
  return -1;
}

/**
 * Moves label centres apart so neighbours are at least `lineHeight` apart and every centre stays in
 * [min, max] when there is room. Returns the positions in input order.
 */
export function spreadLabels(desired: number[], lineHeight: number, min: number, max: number): number[] {
  const order = desired.map((_, i) => i).sort((a, b) => desired[a] - desired[b]);
  const placed = new Array<number>(desired.length);

  let prev = -Infinity;
  for (const i of order) {
    const y = Math.max(desired[i], min, prev + lineHeight);
    placed[i] = y;
    prev = y;
  }

  let next = Infinity;
  for (let k = order.length - 1; k >= 0; k--) {
    const i = order[k];
    const y = Math.min(placed[i], max, next - lineHeight);
    placed[i] = y;
    next = y;
  }

  // too many labels for the space: keep the top one in bounds and let the rest stack from it
  prev = -Infinity;
  for (const i of order) {
    const y = Math.max(placed[i], min, prev + lineHeight);
    placed[i] = y;
    prev = y;
  }

  return placed;
}

/**
 * Text shown for an annotation label: the first non-empty line of its text with markup removed,
 * truncated with an ellipsis.
 */
export function getAnnotationLabelText(text: unknown, maxChars = ANNOTATION_LABEL_MAX_CHARS): string {
  if (typeof text !== 'string') {
    return '';
  }
  const line =
    text
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .split('\n')
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .find((l) => l.length > 0) ?? '';

  if (line.length <= maxChars) {
    return line;
  }
  return `${line.slice(0, maxChars - 1).trimEnd()}…`;
}

export interface AnnotationLabelPlacement {
  row: number;
  left: number;
  /** Width the text may use; less than its natural width when it has to be truncated. */
  width: number;
}

export interface AnnotationLabelBounds {
  /** Space between a leader line and its text. */
  offset: number;
  /** Minimum space between two labels in a row. */
  gap: number;
  minX: number;
  maxX: number;
  rows: number;
  /** Narrowest truncated label worth drawing; below this only the leader is drawn. */
  minWidth: number;
}

/**
 * Places each annotation label (in time order) without overlap: right of its line in the first
 * row with room, otherwise left of it, otherwise truncated into the widest free gap after the
 * line. Returns `undefined` for a label that cannot fit at `minWidth`; its leader still draws.
 */
export function layoutAnnotationLabels(
  xs: number[],
  widths: number[],
  bounds: AnnotationLabelBounds
): Array<AnnotationLabelPlacement | undefined> {
  const occupied: Array<Array<[number, number]>> = Array.from({ length: bounds.rows }, () => []);
  const isFree = (row: number, start: number, end: number) =>
    start >= bounds.minX &&
    end <= bounds.maxX &&
    occupied[row].every(([a, b]) => end + bounds.gap <= a || start >= b + bounds.gap);
  const take = (row: number, left: number, width: number): AnnotationLabelPlacement => {
    occupied[row].push([left, left + width]);
    return { row, left, width };
  };

  return xs.map((x, i) => {
    const width = widths[i];
    const right = x + bounds.offset;
    const left = x - bounds.offset - width;

    for (let row = 0; row < bounds.rows; row++) {
      if (isFree(row, right, right + width)) {
        return take(row, right, width);
      }
    }
    for (let row = 0; row < bounds.rows; row++) {
      if (isFree(row, left, left + width)) {
        return take(row, left, width);
      }
    }

    let best: AnnotationLabelPlacement | undefined;
    for (let row = 0; row < bounds.rows; row++) {
      const nextStart = occupied[row]
        .map(([a]) => a)
        .filter((a) => a >= right)
        .reduce((min, a) => Math.min(min, a), bounds.maxX + bounds.gap);
      const free = nextStart - bounds.gap - right;
      const blocked = occupied[row].some(([a, b]) => a < right && b + bounds.gap > right);
      if (!blocked && free >= bounds.minWidth && free > (best?.width ?? 0)) {
        best = { row, left: right, width: Math.min(free, width) };
      }
    }
    return best ? take(best.row, best.left, best.width) : undefined;
  });
}
