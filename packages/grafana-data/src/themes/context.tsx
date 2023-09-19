import React from 'react';

import { createTheme } from './createTheme';

// Use Grafana Dark theme by default
/** @public */
export const ThemeContext = React.createContext(createTheme());

ThemeContext.displayName = 'ThemeContext';
