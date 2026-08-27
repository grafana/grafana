import { type Decorator } from '@storybook/react';
import * as React from 'react';

import { ThemeContext } from '@grafana/data';

import { useTheme2 } from '../../themes/ThemeContext';

/**
 * Forces the visual design refresh theme flag on for its children, regardless of the theme
 * selected in the Storybook toolbar. Useful for reliably demonstrating behavior that's gated
 * behind the flag in stories and docs examples.
 */
export const VisualDesignRefreshProvider = ({ children }: React.PropsWithChildren) => {
  const theme = useTheme2();
  const refreshedTheme = { ...theme, flags: { ...theme.flags, visualDesignRefresh: true } };
  return <ThemeContext.Provider value={refreshedTheme}>{children}</ThemeContext.Provider>;
};

export const withVisualDesignRefresh: Decorator = (story) => (
  <VisualDesignRefreshProvider>{story()}</VisualDesignRefreshProvider>
);
