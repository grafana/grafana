import React from 'react';
import { useHistory } from 'react-router-dom';

import { Button } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';

export interface ReturnToPreviousProps {
  href: string;
  title: string;
  children: string;
}

export const ReturnToPrevious = ({ href, title, children }: ReturnToPreviousProps) => {
  const { chrome } = useGrafana();
  const history = useHistory();

  const handleOnClick = () => {
    chrome.setReturnToPrevious({ show: false, href: '', title: '' });
    history.push(href);
  };

  return (
    <Button
      icon="angle-left"
      size="sm"
      variant="secondary"
      onClick={handleOnClick}
      title={title}
      className="return-to-previous"
    >
      Back to {children}
    </Button>
  );
};

ReturnToPrevious.displayName = 'ReturnToPrevious';
