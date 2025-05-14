import { cloneElement, useCallback } from 'react';

import { useReturnToPrevious } from '@grafana/runtime';

interface WithReturnButtonProps {
  component: JSX.Element;
  title?: string;
}

// @TODO translations?
export const WithReturnButton = ({ component, title = 'previous page' }: WithReturnButtonProps) => {
  const returnToPrevious = useReturnToPrevious();

  const returnToThisURL = useCallback(() => {
    returnToPrevious(title);
  }, [returnToPrevious, title]);

  return cloneElement(component, { onClick: returnToThisURL });
};
