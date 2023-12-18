import { css } from '@emotion/css';
import React from 'react';
import { useHistory } from 'react-router-dom';

import { GrafanaTheme2, UrlQueryValue } from '@grafana/data';
import { Button, ButtonGroup, useStyles2 } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

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
  const params = useQueryParams()[0];
  const closeButton = () => {
    params.returnToUrl = null;
    params.returnToTitle = null;
    history.push({ search: params.toString() });
  };

  const titleLength = 37;
  const button = () => {
    return (
      <ButtonGroup className={styles.wrapper}>
        <Button
          icon="angle-left"
          size="sm"
          variant="primary"
          fill="outline"
          onClick={handleOnClick}
          title={title?.toString()}
          className={styles.returnToPrevious}
        >
          Back to {children?.toString().slice(0, titleLength).concat('...')}
        </Button>
        <Button icon="times" aria-label="Close" variant="primary" fill="outline" size="sm" onClick={closeButton} />
      </ButtonGroup>
    );
  };
  return button();
};
const getStyles = (theme: GrafanaTheme2) => ({
  returnToPrevious: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }),
  wrapper: css({
    backgroundColor: theme.colors.background.secondary,
    display: 'flex',
    justifyContent: 'space-between',
  }),
});

ReturnToPrevious.displayName = 'ReturnToPrevious';
