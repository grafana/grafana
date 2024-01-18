import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { locationService, setReturnToPrevious } from '@grafana/runtime';
import { Button, ButtonGroup, useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { Trans, t } from 'app/core/internationalization';

export interface ReturnToPreviousProps {
  href: string;
  title: string;
}

export const ReturnToPrevious = ({ href, title }: ReturnToPreviousProps) => {
  const { chrome } = useGrafana();
  const styles = useStyles2(getStyles);
  const handleOnClick = () => {
    setReturnToPrevious({ title: '', href: '' });
    locationService.push(href);
  };
  const closeButton = () => {
    setReturnToPrevious({ title: '', href: '' });
    chrome.update({ returnToPrevious: { title: '', href: '' } });
  };

  return (
    <div className={styles.wrapper}>
      <ButtonGroup className={styles.buttonGroup}>
        <Button
          icon="angle-left"
          size="sm"
          variant="primary"
          fill="outline"
          onClick={handleOnClick}
          title={title}
          className={styles.returnToPrevious}
        >
          <Trans i18nKey="return-to-previous.button.title">Back to {{ title }}</Trans>
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
    </div>
  );
};
const getStyles = (theme: GrafanaTheme2) => ({
  returnToPrevious: css({
    width: '100%',
    ['span']: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      maxWidth: '270px',
      display: 'inline-block',
    },
  }),
  wrapper: css({
    label: 'return-to-previous-wrapper',
    display: 'flex',
    justifyContent: 'center',
    zIndex: theme.zIndex.portal,
    width: '100%',
    position: 'fixed',
    bottom: `${theme.spacing.x4}`,
    right: 0,
  }),
  buttonGroup: css({
    width: 'fit-content',
    backgroundColor: theme.colors.background.secondary,
  }),
});

ReturnToPrevious.displayName = 'ReturnToPrevious';
