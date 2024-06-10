// Code based on Material UI
// The MIT License (MIT)
// Copyright (c) 2014 Call-Em-All

/** @internal */
export type ThemeSpacingOptions = {
  gridSize?: number;
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

// Possible spacing token options
export type ThemeSpacingTokens = 0 | 0.25 | 0.5 | 1 | 1.5 | 2 | 2.5 | 3 | 4 | 5 | 6 | 8 | 10;

// Spacing tokens as represented in the theme
type SpacingTokens = {
  [key in `x${Exclude<ThemeSpacingTokens, 0.25 | 0.5 | 1.5 | 2.5> | '0_25' | '0_5' | '1_5' | '2_5'}`]: string;
};

/** @internal */
export function createSpacing(options: ThemeSpacingOptions = {}): ThemeSpacing {
  const { gridSize = 8 } = options;

  const transform = (value: ThemeSpacingArgument) => {
    if (typeof value === 'string') {
      return value;
    }

    if (process.env.NODE_ENV !== 'production') {
      if (typeof value !== 'number') {
        console.error(`Expected spacing argument to be a number or a string, got ${value}.`);
      }
    }
    return value * gridSize;
  };

  const spacing = (...args: Array<number | string>): string => {
    if (process.env.NODE_ENV !== 'production') {
      if (!(args.length <= 4)) {
        console.error(`Too many arguments provided, expected between 0 and 4, got ${args.length}`);
      }
    }

    if (args.length === 0) {
      args[0] = 1;
    }

    return args
      .map((argument) => {
        const output = transform(argument);
        return typeof output === 'number' ? `${output}px` : output;
      })
      .join(' ');
  };

  spacing.gridSize = gridSize;

  // Design system spacing tokens
  // Added in v10.2 of Grafana, if using spacing in a plugin that needs compatibility with older versions
  // use the spacing function instead.
  spacing.x0 = '0px';
  spacing.x0_25 = '2px';
  spacing.x0_5 = '4px';
  spacing.x1 = '8px';
  spacing.x1_5 = '12px';
  spacing.x2 = '16px';
  spacing.x2_5 = '20px';
  spacing.x3 = '24px';
  spacing.x4 = '32px';
  spacing.x5 = '40px';
  spacing.x6 = '48px';
  spacing.x8 = '64px';
  spacing.x10 = '80px';

  return spacing;
}
