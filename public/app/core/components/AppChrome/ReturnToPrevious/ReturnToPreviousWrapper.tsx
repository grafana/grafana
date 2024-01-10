import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

import { ReturnToPrevious } from './ReturnToPrevious';

export const ReturnToPreviousWrapper = () => {
  const [params] = useQueryParams();
  const styles = useStyles2(getStyles);
  const theme = useTheme2();

  const [paramsExist, setParamsExist] = React.useState(params?.__returnToTitle && params?.__returnToUrl);
  // Don't show the button whether if there is no params or the URL param matches the current URL
  const showReturnToPrevious: boolean = paramsExist && location.pathname !== params.__returnToUrl ? true : false;

  // Only show the button on large screens
  const isLargeScreen = window.innerWidth >= theme.breakpoints.values.xl;

  React.useEffect(() => {
    if (params?.__returnToTitle && params?.__returnToUrl) {
      setParamsExist(true);
    } else {
      setParamsExist(false);
    }
  }, [params]);

  return showReturnToPrevious && isLargeScreen ? (
    <div className={styles.wrapper}>
      <ReturnToPrevious href={params.__returnToUrl} title={params.__returnToTitle}>
        {params.__returnToTitle}
      </ReturnToPrevious>
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
