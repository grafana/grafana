// Possible spacing token options
export type ThemeSpacingTokens = 0 | 0.25 | 0.5 | 1 | 1.5 | 2 | 2.5 | 3 | 4 | 5 | 6 | 8 | 10;

// Spacing tokens as represented in the theme
export type SpacingTokens = {
  [key in `x${Exclude<ThemeSpacingTokens, 0.25 | 0.5 | 1.5 | 2.5> | '0_25' | '0_5' | '1_5' | '2_5'}`]: string;
};

/** @internal */
export type ThemeSpacingArgument = number | string;

/**
 * @beta
 * The different signatures imply different meaning for their arguments that can't be expressed structurally.
 * We express the difference with variable names.
 * tslint:disable:unified-signatures */
export interface ThemeSpacing extends SpacingTokens {
  (): string;
  (value: ThemeSpacingArgument): string;
  (topBottom: ThemeSpacingArgument, rightLeft: ThemeSpacingArgument): string;
  (top: ThemeSpacingArgument, rightLeft: ThemeSpacingArgument, bottom: ThemeSpacingArgument): string;
  (
    top: ThemeSpacingArgument,
    right: ThemeSpacingArgument,
    bottom: ThemeSpacingArgument,
    left: ThemeSpacingArgument
  ): string;
  gridSize: number;
}
