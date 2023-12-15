import { css } from '@emotion/css';
import React from 'react';
import { useHistory } from 'react-router-dom';

import { UrlQueryValue } from '@grafana/data';
import { Button, ButtonGroup, IconButton, Tooltip, useStyles2 } from '@grafana/ui';

export interface ReturnToPreviousProps {
  href: UrlQueryValue;
  title: UrlQueryValue;
  children: UrlQueryValue;
}

export const ReturnToPrevious = ({ href, title, children }: ReturnToPreviousProps) => {
  const history = useHistory();
  const styles = useStyles2(getStyles);
  const handleOnClick = () => {
    href && history.push(href.toString());
  };

  const titleLength = 15;
  const shortenTitle = children && children.toString().length > titleLength ? true : false;
  const button = () => {
    return (
      <ButtonGroup>
        <Button
          icon="angle-left"
          size="sm"
          variant="secondary"
          onClick={handleOnClick}
          title={title?.toString()}
          className={styles.returnToPrevious}
        >
          Back to {children?.toString()}
        </Button>
        <IconButton name="times" aria-label="Close" variant="secondary" />
      </ButtonGroup>
    );
  };
  return shortenTitle && children ? <Tooltip content={`Back to ${children.toString()}`}>{button()}</Tooltip> : button();
};
const getStyles = () => ({
  returnToPrevious: css({
    maxWidth: '250px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }),
});

ReturnToPrevious.displayName = 'ReturnToPrevious';
