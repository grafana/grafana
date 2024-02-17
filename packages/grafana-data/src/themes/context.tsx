import React from 'react';

import { createTheme } from './createTheme';

/** @public */
export const ThemeContext = React.createContext(createTheme());

ThemeContext.displayName = 'ThemeContext';
