import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

import { ReturnToPrevious } from './ReturnToPrevious';

export const ReturnToPreviousWrapper = () => {
  const params = useQueryParams()[0];
  const [paramsExist, setParamsExist] = React.useState(params?.returnToTitle && params?.returnToUrl);
  const showReturnToPrevious: boolean = paramsExist && location.pathname !== params.returnToUrl ? true : false;
  const styles = useStyles2(getStyles);

  React.useEffect(() => {
    if (params?.returnToTitle && params?.returnToUrl) {
      setParamsExist(true);
    } else {
      setParamsExist(false);
    }
  }, [params]);

  return (
    <div className={styles.wrapper}>
      {showReturnToPrevious && paramsExist && (
        <ReturnToPrevious href={params.returnToUrl} title={params.returnToTitle}>
          {params.returnToTitle}
        </ReturnToPrevious>
      )}
    </div>
  );
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
