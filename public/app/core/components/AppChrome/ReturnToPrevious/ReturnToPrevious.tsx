import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, UrlQueryValue } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Button, ButtonGroup, useStyles2 } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

export interface ReturnToPreviousProps {
  href: UrlQueryValue;
  title: UrlQueryValue;
  children: UrlQueryValue;
}

export const ReturnToPrevious = ({ href, title, children }: ReturnToPreviousProps) => {
  const styles = useStyles2(getStyles);
  const handleOnClick = () => {
    href && locationService.push(href.toString());
  };
  const [, setParams] = useQueryParams();
  const closeButton = () => {
    setParams({ returnToTitle: null, returnToUrl: null });
    const currentLocation = locationService.getLocation();
    locationService.push(currentLocation);
  };

  const shortenTitle = (title: UrlQueryValue) => {
    const titleLength = 37;
    if (title && title.toString().length > titleLength) {
      return title.toString().substring(0, titleLength) + '...';
    } else {
      return title;
    }
  };
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
          Back to {shortenTitle(children)}
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
