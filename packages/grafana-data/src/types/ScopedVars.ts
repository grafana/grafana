import { DataFrame, Field } from './dataFrame';
import { DisplayValue } from './displayValue';

export interface ScopedVar<T = any> {
  text?: any;
  value: T;
}

export interface ScopedVars {
  __dataContext?: DataContextScopedVar;
  [key: string]: ScopedVar | undefined;
}

/**
 * Used by data link macros
 */
export interface DataContextScopedVar {
  value: {
    data: DataFrame[];
    frame: DataFrame;
    field: Field;
    rowIndex?: number;
    frameIndex?: number;
    calculatedValue?: DisplayValue;
  };
}
