import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, UrlQueryMap } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

import { ReturnToPrevious } from './ReturnToPrevious';

export const ReturnToPreviousWrapper = () => {
  const [params] = useQueryParams();
  const styles = useStyles2(getStyles);
  const theme = useTheme2();

  const shouldShowReturnToPrevious = (params: UrlQueryMap) =>
    params?.__returnToTitle && params?.__returnToUrl && location.pathname !== params.__returnToUrl;

  // Don't show the button whether if there is no params or the URL param matches the current URL
  const [showReturnToPrevious, setShowReturnToPrevious] = React.useState(shouldShowReturnToPrevious(params));

  // Only show the button on large screens
  const isLargeScreen = window.innerWidth >= theme.breakpoints.values.xl;

  React.useEffect(() => {
    setShowReturnToPrevious(shouldShowReturnToPrevious(params));
  }, [params]);

  return showReturnToPrevious && isLargeScreen ? (
    <div className={styles.wrapper}>
      <ReturnToPrevious href={params.__returnToUrl} title={params.__returnToTitle} />
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
