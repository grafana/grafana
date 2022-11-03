import React from 'react';

export interface Props {
  featureToggle: boolean;
}

export const WithFeatureToggle = ({ featureToggle, children }: React.PropsWithChildren<Props>) => {
  if (featureToggle === true) {
    return <>{children}</>;
  }

  return null;
};
