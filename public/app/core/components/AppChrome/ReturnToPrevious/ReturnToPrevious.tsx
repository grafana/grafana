import { css } from '@emotion/css';
import { useCallback } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';

import { DismissableButton } from './DismissableButton';

export interface ReturnToPreviousProps {
  title: string;
  href: string;
  /** How much of the window's bottom edge something else takes, such as the Assistant docked there; it stays above. */
  bottomInset?: number;
}

export const ReturnToPrevious = ({ href, title, bottomInset = 0 }: ReturnToPreviousProps) => {
  const styles = useStyles2(getStyles, bottomInset);
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
const getStyles = (theme: GrafanaTheme2, bottomInset: number) => ({
  returnToPrevious: css({
    label: 'return-to-previous',
    display: 'flex',
    justifyContent: 'center',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: theme.zIndex.tooltip,
    position: 'fixed',
    bottom: bottomInset > 0 ? `calc(${theme.spacing.x4} + ${bottomInset}px)` : theme.spacing.x4,
    boxShadow: theme.flags.visualDesignRefresh ? theme.shadows.z2 : theme.shadows.z3,
  }),
});

ReturnToPrevious.displayName = 'ReturnToPrevious';
