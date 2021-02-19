import darkTheme from './dark';
import lightTheme from './light';
import { GrafanaTheme } from '@grafana/data';

let themeMock: ((name?: string) => GrafanaTheme) | null;

export const getTheme = (name?: string) =>
  (themeMock && themeMock(name)) || (name === 'light' ? lightTheme : darkTheme);

export const mockTheme = (mock: (name?: string) => GrafanaTheme) => {
  themeMock = mock;
  return () => {
    themeMock = null;
  };
};
