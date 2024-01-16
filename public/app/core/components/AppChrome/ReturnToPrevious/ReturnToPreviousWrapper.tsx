import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';

import { ReturnToPrevious } from './ReturnToPrevious';

export const ReturnToPreviousWrapper = () => {
  const { chrome } = useGrafana();
  const state = chrome.useState();
  const theme = useTheme2();
  const styles = getStyles(theme);

  const shouldShowReturnToPrevious =
    state.returnToPrevious.href !== '' &&
    state.returnToPrevious.title !== '' &&
    location.pathname !== state.returnToPrevious.href;

  // Don't show the button whether if there is no params or the URL param matches the current URL
  const [showReturnToPrevious, setShowReturnToPrevious] = React.useState(shouldShowReturnToPrevious);

  React.useEffect(() => {
    setShowReturnToPrevious(shouldShowReturnToPrevious);
  }, [shouldShowReturnToPrevious]);

  return showReturnToPrevious ? (
    <div className={styles.wrapper}>
      <ReturnToPrevious href={state.returnToPrevious.href} title={state.returnToPrevious.title} />
    </div>
  ) : null;
};

ReturnToPreviousWrapper.displayName = 'ReturnToPreviousWrapper';

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      label: 'return-to-previous-wrapper',
      zIndex: theme.zIndex.portal,
      width: '100%',
      position: 'fixed',
      right: 0,
      bottom: 0,
      padding: `${theme.spacing.x4} 0`,
      display: 'flex',
      justifyContent: 'center',
    }),
  };
}
