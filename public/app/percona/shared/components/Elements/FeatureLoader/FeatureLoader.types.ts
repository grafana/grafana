import { PropsWithChildren } from 'react';

import { OrgRole, StoreState } from 'app/types';

export interface FeatureLoaderProps extends PropsWithChildren {
  featureName?: string;
  featureSelector?: (state: StoreState) => boolean;
  messagedataTestId?: string;
  allowedRoles?: OrgRole[];
}
