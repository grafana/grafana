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
export interface ThemeSpacing extends ThemeSpacingTokens {
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
  // Function to get the numeric value of a spacing token
  num: (key: SpacingTokenValues) => number;
}

// Possible spacing token options
type SpacingTokenValues = 0 | 25 | 50 | 100 | 150 | 200 | 250 | 300 | 400 | 500 | 600 | 800 | 1000;

// Spacing tokens as represented in the theme
type ThemeSpacingTokens = {
  [key in `x${SpacingTokenValues}`]: string;
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

  // Function to get the numeric value of a spacing token
  spacing.num = (key: SpacingTokenValues): number => {
    const pxVal = spacing[`x${key}`];
    return parseInt(pxVal, 10);
  };

  // Design system spacing tokens
  spacing.x0 = '0px';
  spacing.x25 = '2px';
  spacing.x50 = '4px';
  spacing.x100 = '8px';
  spacing.x150 = '12px';
  spacing.x200 = '16px';
  spacing.x250 = '20px';
  spacing.x300 = '24px';
  spacing.x400 = '32px';
  spacing.x500 = '40px';
  spacing.x600 = '48px';
  spacing.x800 = '64px';
  spacing.x1000 = '80px';

  return spacing;
}
