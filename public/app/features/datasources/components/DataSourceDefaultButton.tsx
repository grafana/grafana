import { useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import { Badge, Tooltip, Button } from '@grafana/ui';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { notifyApp } from 'app/core/reducers/appNotification';
import { useDispatch } from 'app/types/store';

import * as api from '../api';
import { useDataSource, useDataSourceRights } from '../state/hooks';
import { setIsDefault } from '../state/reducers';

export const DataSourceDefaultButton = ({ uid }: { uid: string }) => {
  const [loading, setLoading] = useState(false);

  const dataSource = useDataSource(uid);
  const rights = useDataSourceRights(uid);
  const editable = rights.hasWriteRights && !rights.readOnly;

  const dispatch = useDispatch();

  const onChangeDefault = async (value: boolean) => {
    if (loading) {
      return;
    }
    setLoading(true);

    try {
      // Make manual API calls to avoid pre-emptively saving other changes from the EditDataSource form
      const ds = await api.getDataSourceByUid(uid);
      await api.updateDataSource({ ...ds, isDefault: value });
      dispatch(setIsDefault(value));
    } catch (error) {
      dispatch(
        notifyApp(
          createErrorNotification(
            t('datasources.default-button.error', 'Failed to update default data source'),
            isFetchError(error) ? error.data.message : error instanceof Error ? error.message : undefined
          )
        )
      );
    } finally {
      setLoading(false);
    }
  };

  if (!editable) {
    return dataSource.isDefault ? (
      <Badge
        text={
          <Tooltip
            content={[
              t('datasources.default-button.active', 'This data source is currently set as the default.'),
              t('datasources.default-button.tooltip', 'The default data source is preselected in new panels.'),
            ].join(' ')}
          >
            <span>
              <Trans i18nKey="datasources.default-button.label">Default</Trans>
            </span>
          </Tooltip>
        }
        color="blue"
      />
    ) : null;
  }

  return (
    <Button
      variant="secondary"
      size="sm"
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
    >
      {dataSource.isDefault ? (
        <Trans i18nKey="datasources.default-button.remove">Remove default</Trans>
      ) : (
        <Trans i18nKey="datasources.default-button.make">Make default</Trans>
      )}
    </Button>
  );
};
