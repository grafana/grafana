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
}
