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
  changeLogs?: CheckUpdatesChangelogsPayload;
  snoozeCurrentVersion?: SnoozePayloadResponse;
}

export interface CheckUpdatesPayload {
  installed?: CurrentInformation;
  latest?: LatestInformation;
  latestNewsUrl?: string;
  lastChecked?: string;
  updateAvailable: boolean;
}

export interface UpdatesChangelogs {
  version: string;
  tag: string;
  timestamp: string;
  releaseNodesUrl: string;
  releaseNotesText: string;
}

export interface CheckUpdatesChangelogsPayload {
  updates: UpdatesChangelogs[];
  lastCheck: string;
}

export interface SnoozePayloadBody {
  productTourCompleted: boolean;
  alertingTourCompleted: boolean;
  snoozedPmmVersion: string;
}

export interface SnoozePayloadResponse {
  userId: number;
  productTourCompleted: boolean;
  alertingTourCompleted: boolean;
  snoozedPmmVersion: string;
}
