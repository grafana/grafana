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
  changeLogs?: CheckUpdatesChangeLogs;
  showUpdateModal: boolean;
}

export interface CheckUpdatesPayload {
  installed?: CurrentInformation;
  latest?: LatestInformation;
  latestNewsUrl?: string;
  lastChecked?: string;
  updateAvailable: boolean;
}

export interface UpdatesChangeLogsResponse {
  version: string;
  tag: string;
  timestamp: string;
  release_notes_url: string;
  release_notes_text: string;
}

export interface UpdatesChangeLogs {
  version: string;
  tag: string;
  timestamp: string;
  releaseNotesUrl: string;
  releaseNotesText: string;
}

export interface CheckUpdatesChangeLogs {
  updates: UpdatesChangeLogs[];
  lastCheck: string;
}

export interface CheckUpdatesChangeLogsResponse {
  updates: UpdatesChangeLogsResponse[];
  last_check: string;
}
