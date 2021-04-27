import { createTheme, GrafanaTheme } from '@grafana/data';

let themeMock: ((name?: string) => GrafanaTheme) | null;

export const getTheme = (mode: 'dark' | 'light' = 'dark') => {
  if (themeMock) {
    return themeMock(mode);
  }

  return createTheme({ colors: { mode } }).v1;
};

export const mockTheme = (mock: (name?: string) => GrafanaTheme) => {
  themeMock = mock;
  return () => {
    themeMock = null;
  };
};
