import React, { FC } from 'react';

import { Spinner, useStyles } from '@grafana/ui';
import { getPerconaSettings } from 'app/percona/shared/core/selectors';
import { useSelector } from 'app/types';

import { EmptyBlock } from '../EmptyBlock';

import { getStyles } from './PermissionLoader.styles';
import { PermissionLoaderProps } from './PermissionLoader.types';

export const PermissionLoader: FC<React.PropsWithChildren<PermissionLoaderProps>> = ({ featureSelector, renderSuccess, renderError }) => {
  const styles = useStyles(getStyles);
  const featureEnabled = useSelector(featureSelector);
  const { loading } = useSelector(getPerconaSettings);

  if (loading) {
    return <Spinner />;
  }

  if (featureEnabled) {
    return <>{renderSuccess()}</>;
  }

  return (
    <div className={styles.emptyBlock}>
      <EmptyBlock dataTestId="empty-block">{renderError()}</EmptyBlock>
    </div>
  );
};
