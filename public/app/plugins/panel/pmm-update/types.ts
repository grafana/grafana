import { MouseEvent } from 'react';

type OpaqueTag<S extends string> = {
  readonly __tag: S;
};

export type SuperOpaque<S extends string> = OpaqueTag<S>;
export type WeakOpaque<T, S extends string> = T & OpaqueTag<S>;
export type StrongOpaque<T, S extends string> = WeakOpaque<T, S> | SuperOpaque<S>;

export type ISOTimestamp = WeakOpaque<string, 'ISOTimestamp'>;

export interface GetUpdatesBody {
  force: boolean;
  onlyInstalledVersion?: boolean;
}

export interface GetUpdateStatusBody {
  auth_token: string;
  log_offset: number;
}

export interface GetUpdatesResponse {
  last_check: ISOTimestamp;
  latest: {
    full_version: string;
    timestamp: ISOTimestamp;
    version: string;
  };
  installed: {
    full_version: string;
    timestamp: ISOTimestamp;
    version: string;
  };
  latest_news_url: string;
  update_available: boolean;
}

export interface GetUpdateStatusResponse {
  done: boolean;
  log_offset: number;
  log_lines: string[];
}

export interface StartUpdateResponse {
  auth_token: string;
  log_offset: number;
}

export interface InstalledVersionDetails {
  installedVersion: string;
  installedFullVersion: string;
  installedVersionDate: string;
}

export interface NextVersionDetails {
  nextVersion: string;
  nextFullVersion: string;
  nextVersionDate: string;
  newsLink: string;
}

export type CurrentOrNextVersionDetails = [
  {
    installedVersionDetails: InstalledVersionDetails;
    lastCheckDate: string;
    nextVersionDetails: NextVersionDetails;
    isUpdateAvailable: boolean;
  },
  string,
  boolean,
  boolean,
  (body?: GetUpdatesBody) => void
];

export interface ProgressModalProps {
  version: string;
  errorMessage?: string;
  isOpen?: boolean;
  isUpdated?: boolean;
  output?: string;
  updateFailed?: boolean;
}

export interface LastCheckProps {
  lastCheckDate: string;
  onCheckForUpdates: (e: MouseEvent) => void;
  disabled?: boolean;
}

export interface CurrentVersionProps {
  installedVersionDetails: InstalledVersionDetails;
}

export interface ProgressModalHeaderProps {
  errorMessage?: string;
  isUpdated?: boolean;
  updateFailed?: boolean;
}

export interface InfoBoxProps {
  upToDate?: boolean;
  updatesDisabled?: boolean;
  hasNoAccess?: boolean;
  isOnline?: boolean;
}

export interface AvailableUpdateProps {
  nextVersionDetails: NextVersionDetails;
}

export type UpdateStatus = [string, string, boolean, boolean, () => void];

export type ApiCall<R, A> = [R | undefined, string, boolean, (args?: A) => void];

export type UpdateInitialization = [string, number, boolean, () => void];
