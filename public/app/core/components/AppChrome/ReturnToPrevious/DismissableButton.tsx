import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Button, ButtonGroup, useStyles2 } from '@grafana/ui';

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
        data-testid={selectors.components.ReturnToPrevious.backButton}
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
        data-testid={selectors.components.ReturnToPrevious.dismissButton}
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
