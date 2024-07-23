export interface CurrentInformation {
  version?: string;
  fullVersion?: string;
  timestamp?: string;
}

export interface LatestInformation {
  version?: string;
  tag?: string;
  timestamp?: string;
}

export interface UpdatesState {
  isLoading: boolean;
  updateAvailable?: boolean;
  installed?: CurrentInformation;
  latest?: LatestInformation;
  latestNewsUrl?: string;
  lastChecked?: string;
}

export interface CheckUpdatesPayload {
  installed?: CurrentInformation;
  latest?: LatestInformation;
  latestNewsUrl?: string;
  lastChecked?: string;
  updateAvailable: boolean;
}
