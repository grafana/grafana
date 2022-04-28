import React, { FC } from 'react';
import { useSelector } from 'react-redux';
import { Spinner, useStyles } from '@grafana/ui';
import { getPerconaSettings } from 'app/percona/shared/core/selectors';
import { EmptyBlock } from '../EmptyBlock';
import { PermissionLoaderProps } from './PermissionLoader.types';
import { getStyles } from './PermissionLoader.styles';

export const PermissionLoader: FC<PermissionLoaderProps> = ({ featureSelector, renderSuccess, renderError }) => {
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
