import * as z from 'zod';

import { type ThemeColors } from './createColors';
import { resolvePaletteRefs } from './palette_new';
import { type DeepRequired } from './types';

/** @internal */
export const ThemeShadowsInputSchema = z.object({
  /** Applies to elements that sit directly on the page */
  z1: z.string().optional(),
  /** Applies to overlays e.g. dropdown, menu, tooltip */
  z2: z.string().optional(),
  /** Applies to overlays that require a backdrop, e.g. modals, drawers */
  z3: z.string().optional(),
});

type ThemeShadowsInput = z.infer<typeof ThemeShadowsInputSchema>;

export type ThemeShadows = DeepRequired<z.infer<typeof ThemeShadowsInputSchema>>;

const DEFAULT_DARK_SHADOWS: ThemeShadows = {
  z1: '0px 1px 2px rgba(1, 4, 9, 0.75)',
  z2: '0px 4px 8px rgba(1, 4, 9, 0.75)',
  z3: '0px 8px 24px rgb(1, 4, 9)',
};

const DEFAULT_LIGHT_SHADOWS: ThemeShadows = {
  z1: '0px 1px 2px rgba(24, 26, 27, 0.2)',
  z2: '0px 4px 8px rgba(24, 26, 27, 0.2)',
  z3: '0px 13px 20px 1px rgba(24, 26, 27, 0.18)',
};

/** @alpha */
export function createShadows(colors: ThemeColors, input: ThemeShadowsInput = {}): ThemeShadows {
  input = resolvePaletteRefs(input);
  const defaultShadows = colors.mode === 'dark' ? DEFAULT_DARK_SHADOWS : DEFAULT_LIGHT_SHADOWS;

  return {
    z1: input.z1 ?? defaultShadows.z1,
    z2: input.z2 ?? defaultShadows.z2,
    z3: input.z3 ?? defaultShadows.z3,
  };
}
