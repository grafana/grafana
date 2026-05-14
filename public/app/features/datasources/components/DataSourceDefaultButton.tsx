import { css } from '@emotion/css';
import { useState } from 'react';

import { type DataSourceSettings, type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import { Button, useStyles2 } from '@grafana/ui';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { notifyApp } from 'app/core/reducers/appNotification';
import { useDispatch } from 'app/types/store';

import * as api from '../api';
import { setDataSourcesDefault } from '../state/reducers';

export const DataSourceDefaultButton = ({ dataSource }: { dataSource: DataSourceSettings }) => {
  const styles = useStyles2(getStyles);
  const [loading, setLoading] = useState(false);

  const dispatch = useDispatch();

  const onChangeDefault = async (value: boolean) => {
    if (loading) {
      return;
    }
    setLoading(true);

    try {
      const ds = await api.getDataSourceByUid(dataSource.uid);
      await api.updateDataSource({ ...ds, isDefault: value });
      dispatch(setDataSourcesDefault({ uid: dataSource.uid, isDefault: value }));
    } catch (error) {
      dispatch(
        notifyApp(
          createErrorNotification(
            t('datasources.default-button.error', 'Failed to update default data source'),
            isFetchError(error) ? error.data.message : error instanceof Error ? error.message : undefined
          )
        )
      );
    }

    setLoading(false);
  };

  return (
    <Button
      size="sm"
      fill="text"
      tooltip={[
        dataSource.isDefault &&
          t('datasources.default-button.active', 'This data source is currently set as the default.'),
        t('datasources.default-button.tooltip', 'The default data source is preselected in new panels.'),
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => onChangeDefault(!dataSource.isDefault)}
      icon={loading ? 'spinner' : undefined}
      iconPlacement="right"
      disabled={loading}
      className={styles.button}
    >
      {dataSource.isDefault ? (
        <Trans i18nKey="datasources.default-button.remove">Remove default</Trans>
      ) : (
        <Trans i18nKey="datasources.default-button.make">Make default</Trans>
      )}
    </Button>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    button: css({
      pointerEvents: 'auto',
      position: 'relative',
    }),
  };
};
