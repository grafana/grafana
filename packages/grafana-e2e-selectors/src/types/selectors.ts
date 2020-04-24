export type Selectors = Record<string, string | Function>;

export const selectorFactory = <S extends Selectors>(selectors: S): S => selectors;
