type SupportBundleState = 'complete' | 'error' | 'timeout' | 'pending';

export interface SupportBundle {
  uid: string;
  state: SupportBundleState;
  creator: string;
  createdAt: number;
  expiresAt: number;
}

export interface SupportBundlesState {
  supportBundles: SupportBundle[];
  isLoading: boolean;
  createBundlePageLoading: boolean;
  supportBundleCollectors: SupportBundleCollector[];
  loadBundlesError: string;
  createBundleError: string;
}

export interface SupportBundleCollector {
  uid: string;
  displayName: string;
  description: string;
  includedByDefault: boolean;
  default: boolean;
}

export interface SupportBundleCreateRequest {
  collectors: string[];
}
