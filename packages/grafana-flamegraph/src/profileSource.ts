import { type DataFrame, FieldType } from '@grafana/data';

export interface ProfileSource {
  /** Changes for a new query, but not when refinement replaces the displayed frame. */
  id: string;
  /** Completeness of the initial, unfocused profile (both sides for diff). */
  truncated: boolean;
}

const truncationCache = new WeakMap<DataFrame, boolean>();

/** Inspect the original frame, before focus, collapsing or sandwich transformations. */
export function isProfileTruncated(frame: DataFrame): boolean {
  const cached = truncationCache.get(frame);
  if (cached !== undefined) {
    return cached;
  }
  let truncated = false;
  for (let index = 0; index < frame.length; index++) {
    if (isTruncatedRow(frame, index)) {
      truncated = true;
      break;
    }
  }
  truncationCache.set(frame, truncated);
  return truncated;
}

export function isTruncatedRow(frame: DataFrame, index: number): boolean {
  const marker = frame.fields.find((field) => field.name === 'truncated' && field.type === FieldType.boolean);
  if (marker) {
    return marker.values[index] === true;
  }
  const label = frame.fields.find((field) => field.name === 'label');
  const raw = label?.values[index];
  const name = label?.type === FieldType.enum ? label.config.type?.enum?.text?.[raw] : raw;
  // Pyroscope's legacy wire format reserves this exact name. Display formatting (including "Other") is not identity.
  return name === 'other';
}
