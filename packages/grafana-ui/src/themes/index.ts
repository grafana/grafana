import darkTheme from './dark';
import lightTheme from './light';
import { GrafanaTheme } from '../types/theme';
import { ThemeContext, withTheme } from './ThemeContext';

let themeMock: ((name?: string) => GrafanaTheme) | null;

export let getTheme = (name?: string) => (themeMock && themeMock(name)) || (name === 'light' ? lightTheme : darkTheme);

export const mockTheme = (mock: (name?: string) => GrafanaTheme) => {
  themeMock = mock;
  return () => {
    themeMock = null;
  };
};

export { ThemeContext, withTheme };
