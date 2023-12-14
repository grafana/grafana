import React from 'react';
import { useHistory } from 'react-router-dom';

import { UrlQueryValue } from '@grafana/data';
import { Button } from '@grafana/ui';
// import { useGrafana } from 'app/core/context/GrafanaContext';

export interface ReturnToPreviousProps {
  href: UrlQueryValue;
  title: UrlQueryValue;
  children: UrlQueryValue;
}

export const ReturnToPrevious = ({ href, title, children }: ReturnToPreviousProps) => {
  // const { chrome } = useGrafana();
  const history = useHistory();

  const handleOnClick = () => {
    //   chrome.setReturnToPrevious({ show: false, href: '', title: '' });
    href && history.push(href.toString());
  };

  return (
    <Button
      icon="angle-left"
      size="sm"
      variant="secondary"
      onClick={handleOnClick}
      title={title?.toString()}
      className="return-to-previous"
    >
      Back to {children?.toString()}
    </Button>
  );
};

ReturnToPrevious.displayName = 'ReturnToPrevious';
