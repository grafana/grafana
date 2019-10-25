import React, { FunctionComponent } from 'react';

export interface Props {
  featureToggle: boolean;
}

export const WithFeatureToggle: FunctionComponent<Props> = ({ featureToggle, children }) => {
  if (featureToggle === true) {
    return <>{children}</>;
  }

  return null;
};
