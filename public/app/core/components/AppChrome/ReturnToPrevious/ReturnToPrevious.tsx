import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, UrlQueryValue } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Button, ButtonGroup, useStyles2 } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { Trans, t } from 'app/core/internationalization';

export interface ReturnToPreviousProps {
  href: UrlQueryValue;
  title: UrlQueryValue;
}

export const ReturnToPrevious = ({ href, title }: ReturnToPreviousProps) => {
  const styles = useStyles2(getStyles);
  const [, setParams] = useQueryParams();

  const handleOnClick = () => {
    href && locationService.push(href.toString());
  };
  const closeButton = () => {
    setParams({ __returnToTitle: null, __returnToUrl: null });
    const currentLocation = locationService.getLocation();
    locationService.push(currentLocation);
  };

  const shortenTitle = (title: UrlQueryValue) => {
    const titleLength = 37;
    return title && title.toString().length > titleLength ? title.toString().substring(0, titleLength) + '...' : title;
  };

  const shortTitle = shortenTitle(title);

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
        <Trans i18nKey="return-to-previous.button.title">Back to {{ shortTitle }}</Trans>
      </Button>
      <Button
        icon="times"
        aria-label={t('return-to-previous.button.close', 'Close')}
        variant="primary"
        fill="outline"
        size="sm"
        onClick={closeButton}
      />
    </ButtonGroup>
  );
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
