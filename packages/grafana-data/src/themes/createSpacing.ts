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
export interface ThemeSpacing {
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

  return spacing;
}
