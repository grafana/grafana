import { StoreState } from 'app/types';

export interface PermissionLoaderProps {
  featureSelector: (state: StoreState) => boolean;
  renderSuccess: () => React.ReactNode;
  renderError: () => React.ReactNode;
}
