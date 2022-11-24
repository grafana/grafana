import { ReactNode } from 'react';

import { GrafanaThemeType } from '@grafana/data';

export type FailedToMountGrafanaErrorName = 'FailedToMountGrafana';

export interface GrafanaMicroFrontendState {
  errors: Map<string | number, string | Error>;
}

export type GrafanaMicroFrontendActions = {
  setErrors: (errors: GrafanaMicroFrontendState['errors']) => void;
};

/* eslint-disable-next-line  */
export type AnyObject<K extends string | number | symbol = string, V = any> = {
  [key in K]: V;
};

export interface FNDashboardProps {
  name: string;
  uid: string;
  slug: string;
  mode: GrafanaThemeType.Dark | GrafanaThemeType.Light;
  queryParams: Partial<AnyObject<string, string>>;
  fnError?: ReactNode;
  fnLoader?: ReactNode;
  pageTitle?: string;
  controlsContainer: HTMLElement | null;
  isLoading: (isLoading: boolean) => void;
  setErrors: (errors?: { [K: number | string]: string }) => void;
  hiddenVariables: string[];
  container?: HTMLElement | null;
}
