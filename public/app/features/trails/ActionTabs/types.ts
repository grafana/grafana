const LAYOUT_TYPES = ['single', 'grid', 'rows'] as const;

export type LayoutType = (typeof LAYOUT_TYPES)[number];

export function isLayoutType(layoutType: string | null | undefined): layoutType is LayoutType {
  return !!layoutType && layoutType in LAYOUT_TYPES;
}
