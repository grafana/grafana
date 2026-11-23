import { createContext } from 'react';

/**
 * Whether the panel editor around a field config editor lets options take variable expressions.
 * Editors rendered elsewhere, or on dashboards that can't store expressions, get false.
 */
export const FieldConfigExpressionsContext = createContext(false);
