export interface CheckUpdatesBody {
  force: boolean;
  only_installed_version?: boolean;
}

export interface CurrentInfo {
  version?: string;
  full_version?: string;
  timestamp?: string;
}

export interface LatestInfo {
  version?: string;
  tag?: string;
  timestamp?: string;
}

export interface CheckUpdatesResponse {
  installed?: CurrentInfo;
  latest?: LatestInfo;
  update_available?: boolean;
  latest_news_url?: string;
  last_check?: string;
}
