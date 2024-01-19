import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { DismissableButton } from './DismissableButton';

export interface ReturnToPreviousProps {
  href: string;
  title: string;
}

export const ReturnToPrevious = ({ href, title }: ReturnToPreviousProps) => {
  const styles = useStyles2(getStyles);
  const handleOnClick = () => {
    console.log('Going to...', href);
  };
  const closeButton = () => {
    console.log('Closing button');
  };

  return (
    <div className={styles.returnToPrevious}>
      <DismissableButton
        label={t('return-to-previous.button.label', `Back to ${title}`)}
        onClick={handleOnClick}
        onDismiss={closeButton}
      />
    </div>
  );
};
const getStyles = (theme: GrafanaTheme2) => ({
  returnToPrevious: css({
    label: 'return-to-previous',
    display: 'flex',
    justifyContent: 'center',
    zIndex: theme.zIndex.portal,
    width: '100%',
    position: 'fixed',
    bottom: `${theme.spacing.x4}`,
    right: 0,
  }),
});

ReturnToPrevious.displayName = 'ReturnToPrevious';
