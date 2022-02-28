import { StoreState } from 'app/types';

export interface FeatureLoaderProps {
  featureName: string;
  featureSelector: (state: StoreState) => boolean;
  messagedataTestId?: string;
}
