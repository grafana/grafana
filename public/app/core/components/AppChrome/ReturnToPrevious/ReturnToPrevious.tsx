import React from 'react';
import { useHistory } from 'react-router-dom';

import { UrlQueryValue } from '@grafana/data';
import { Button, Tooltip } from '@grafana/ui';

export interface ReturnToPreviousProps {
  href: UrlQueryValue;
  title: UrlQueryValue;
  children: UrlQueryValue;
}

export const ReturnToPrevious = ({ href, title, children }: ReturnToPreviousProps) => {
  const history = useHistory();

  const handleOnClick = () => {
    href && history.push(href.toString());
  };

  const titleLength = 15;
  const shortenTitle =
    children && children.toString().length > titleLength
      ? children.toString().slice(0, titleLength).concat('...')
      : children;
  const button = () => {
    return (
      <Button
        icon="angle-left"
        size="sm"
        variant="secondary"
        onClick={handleOnClick}
        title={title?.toString()}
        className="return-to-previous"
      >
        Back to {children?.toString().slice(0, 15).concat('...')}
      </Button>
    );
  };
  return shortenTitle && children ? <Tooltip content={`Back to ${children.toString()}`}>{button()}</Tooltip> : button();
};

ReturnToPrevious.displayName = 'ReturnToPrevious';
