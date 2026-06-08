import { useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import { Button, ConfirmModal } from '@grafana/ui';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { notifyApp } from 'app/core/reducers/appNotification';
import { useDispatch } from 'app/types/store';

import * as api from '../api';
import { useDataSource, useDataSourceRights } from '../state/hooks';
import { setIsDefault } from '../state/reducers';

export const DataSourceDefaultButton = ({ uid }: { uid: string }) => {
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const dataSource = useDataSource(uid);
  const rights = useDataSourceRights(uid);
  const editable = rights.hasWriteRights && !rights.readOnly;

  const dispatch = useDispatch();

  const onChangeDefault = async (value: boolean) => {
    if (loading || !confirming) {
      return;
    }
    setLoading(true);
    setConfirming(false);

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
    return null;
  }

  return (
    <>
      <Button
        variant="secondary"
        tooltip={[
          dataSource.isDefault &&
            t('datasources.default-button.active', 'This data source is currently set as the default.'),
          t('datasources.default-button.tooltip', 'The default data source is preselected in new panels.'),
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => setConfirming(true)}
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

      <ConfirmModal
        isOpen={confirming}
        title={
          dataSource.isDefault
            ? t('datasources.default-button.remove', 'Remove default')
            : t('datasources.default-button.make', 'Make default')
        }
        body={[
          dataSource.isDefault
            ? t(
                'datasources.default-button.remove-confirm',
                'Are you sure you want to remove the default status from this data source for all users?'
              )
            : t(
                'datasources.default-button.make-confirm',
                'Are you sure you want to set this data source as the default for all users?'
              ),
          t('datasources.default-button.tooltip', 'The default data source is preselected in new panels.'),
        ].join(' ')}
        confirmText={t('datasources.default-button.confirm', 'Confirm')}
        confirmVariant={dataSource.isDefault ? 'destructive' : 'primary'}
        dismissText={t('datasources.default-button.cancel', 'Cancel')}
        onConfirm={() => onChangeDefault(!dataSource.isDefault)}
        onDismiss={() => setConfirming(false)}
      />
    </>
  );
};
