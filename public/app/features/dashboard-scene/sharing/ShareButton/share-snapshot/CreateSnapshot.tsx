import React from 'react';

import { SceneComponentProps } from '@grafana/scenes';
import { Alert, Button, Divider, Field, Input, RadioButtonGroup, Spinner, Stack, TextLink } from '@grafana/ui';
import { t } from '@grafana/ui/src/utils/i18n';

import { Trans } from '../../../../../core/internationalization';
import { getExpireOptions } from '../../ShareSnapshotTab';

import { ShareSnapshot } from './ShareSnapshot';

const SNAPSHOT_URL = 'https://grafana.com/docs/grafana/latest/dashboards/share-dashboards-panels/#publish-a-snapshot';

interface Props extends SceneComponentProps<ShareSnapshot> {
  onCreateClick: (isExternal?: boolean) => void;
  isLoading: boolean;
}
export function CreateSnapshot({ model, onCreateClick, isLoading }: Props) {
  const { snapshotName, selectedExpireOption, dashboardRef, snapshotSharingOptions } = model.useState();

  return (
    <div>
      <Alert severity="info" title={''}>
        <Stack justifyContent="space-between" gap={2} alignItems="center">
          <Trans i18nKey="share-modal.snapshot.info-text-1">
            A snapshot is an instant way to share an interactive dashboard publicly. When created, we strip sensitive
            data like queries (metric, template, and annotation) and panel links, leaving only the visible metric data
            and series names embedded in your dashboard.
          </Trans>
          <Button variant="secondary" onClick={() => window.open(SNAPSHOT_URL, '_blank')} type="button">
            Learn more
          </Button>
        </Stack>
      </Alert>
      <Field label={t('share-modal.snapshot.name', `Snapshot name`)}>
        <Input
          id="snapshot-name-input"
          defaultValue={snapshotName}
          onBlur={(e) => model.onSnasphotNameChange(e.target.value)}
        />
      </Field>
      <Field label="Expiration Date">
        <RadioButtonGroup<number>
          id="expire-select-input"
          options={getExpireOptions()}
          value={selectedExpireOption?.value}
          onChange={model.onExpireChange}
        />
      </Field>
      <Divider />
      <Stack justifyContent="space-between" gap={2}>
        <Stack justifyContent="flex-start" gap={2}>
          {snapshotSharingOptions?.externalEnabled && (
            <Button variant="secondary" disabled={isLoading} onClick={() => onCreateClick(true)}>
              {snapshotSharingOptions?.externalSnapshotName}
            </Button>
          )}
          <Button variant="primary" disabled={isLoading} onClick={() => onCreateClick()}>
            <Trans i18nKey="share-modal.snapshot.local-button">Publish snapshot</Trans>
          </Button>
          <Button
            variant="secondary"
            fill="outline"
            onClick={() => {
              dashboardRef?.resolve().closeModal();
            }}
          >
            <Trans i18nKey="share-modal.snapshot.cancel-button">Cancel</Trans>
          </Button>
          {isLoading && <Spinner />}
        </Stack>
        <TextLink icon="external-link-alt" href="/dashboard/snapshots">
          View all snapshots
        </TextLink>
      </Stack>
    </div>
  );
}
