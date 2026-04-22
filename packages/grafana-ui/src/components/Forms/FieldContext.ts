import { createContext, useContext } from 'react';

export interface FieldContextType {
  id: string;
  invalid?: boolean;
  disabled?: boolean;
  loading?: boolean;
  'aria-describedby'?: string;
  'aria-labelledby'?: string;
}

export const FieldContext = createContext<FieldContextType>({ id: '' });
FieldContext.displayName = 'FieldContext';

export const useFieldContext = (): FieldContextType => useContext(FieldContext);
