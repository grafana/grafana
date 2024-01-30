import React, { useCallback } from 'react';

import { locationService, useReturnToPrevious } from '@grafana/runtime';

interface WithReturnButtonProps {
  component: JSX.Element;
  title?: string;
}

// @TODO translations?
export const WithReturnButton = ({ component, title = 'previous page' }: WithReturnButtonProps) => {
  const returnToPrevious = useReturnToPrevious();
  const returnHref = locationService.getLocation().pathname + '?' + locationService.getSearch().toString();

  const returnToThisURL = useCallback(() => {
    returnToPrevious({ title, href: returnHref });
  }, [returnHref, returnToPrevious, title]);

  return React.cloneElement(component, { onClick: returnToThisURL });
};
