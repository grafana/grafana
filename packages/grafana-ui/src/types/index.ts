export * from './series';
export * from './time';
export * from './panel';
export * from './plugin';
export * from './datasource';

export enum GrafanaTheme {
  Light = 'light',
  Dark = 'dark',
}

export interface Themeable {
  theme?: GrafanaTheme;
}
