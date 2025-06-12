import { css } from '@emotion/css';
import { useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';

import { DismissableButton } from './DismissableButton';

export interface ReturnToPreviousProps {
  title: string;
  href: string;
}

export const ReturnToPrevious = ({ href, title }: ReturnToPreviousProps) => {
  const styles = useStyles2(getStyles);
  const { chrome } = useGrafana();

  const handleOnClick = useCallback(() => {
    locationService.push(href);
    chrome.clearReturnToPrevious('clicked');
  }, [href, chrome]);

  const handleOnDismiss = useCallback(() => {
    chrome.clearReturnToPrevious('dismissed');
  }, [chrome]);

  return (
    <div className={styles.returnToPrevious} data-testid={selectors.components.ReturnToPrevious.buttonGroup}>
      <DismissableButton
        label={t('return-to-previous.button.label', 'Back to {{title}}', { title })}
        onClick={handleOnClick}
        onDismiss={handleOnDismiss}
      />
    </div>
  );
};
const getStyles = (theme: GrafanaTheme2) => ({
  returnToPrevious: css({
    label: 'return-to-previous',
    display: 'flex',
    justifyContent: 'center',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: theme.zIndex.tooltip,
    position: 'fixed',
    bottom: theme.spacing.x4,
    boxShadow: theme.shadows.z3,
  }),
});

ReturnToPrevious.displayName = 'ReturnToPrevious';
