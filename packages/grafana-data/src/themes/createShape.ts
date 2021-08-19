/** @beta */
export interface ThemeShape {
  borderRadius: (amount?: number) => string;
}

/** @internal */
export interface ThemeShapeInput {
  borderRadius?: number;
}

export function createShape(options: ThemeShapeInput): ThemeShape {
  const baseBorderRadius = options.borderRadius ?? 2;

  const borderRadius = (amount?: number) => {
    const value = (amount ?? 1) * baseBorderRadius;
    return `${value}px`;
  };

  return {
    borderRadius,
  };
}
