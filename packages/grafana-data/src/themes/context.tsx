import { createContext } from 'react';

import { createTheme } from './createTheme';

/** @public */
export const ThemeContext = createContext(createTheme());

ThemeContext.displayName = 'ThemeContext';
