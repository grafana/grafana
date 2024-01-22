import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, ButtonGroup, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

export interface DismissableButtonProps {
  label: string;
  onClick: () => void;
  onDismiss: () => void;
}

export const DismissableButton = ({ label, onClick, onDismiss }: DismissableButtonProps) => {
  const styles = useStyles2(getStyles);

  return (
    <ButtonGroup className={styles.buttonGroup}>
      <Button
        icon="angle-left"
        size="sm"
        variant="primary"
        fill="outline"
        onClick={onClick}
        title={label}
        className={styles.mainDismissableButton}
      >
        {label}
      </Button>
      <Button
        icon="times"
        aria-label={t('return-to-previous.dismissable-button', 'Close')}
        variant="primary"
        fill="outline"
        size="sm"
        onClick={onDismiss}
      />
    </ButtonGroup>
  );
};
const getStyles = (theme: GrafanaTheme2) => ({
  mainDismissableButton: css({
    width: '100%',
    ['> span']: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      maxWidth: '270px',
      display: 'inline-block',
    },
  }),
  buttonGroup: css({
    width: 'fit-content',
    backgroundColor: theme.colors.background.secondary,
  }),
});

DismissableButton.displayName = 'DismissableButton';
