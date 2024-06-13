import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import {
  Alert,
  Divider,
  Field,
  RadioButtonGroup,
  Spinner,
  Stack,
  TextLink,
  Text,
  Button,
  useStyles2,
} from '@grafana/ui';
import { Input } from '@grafana/ui/src/components/Input/Input';
import { t } from '@grafana/ui/src/utils/i18n';
import { Trans } from 'app/core/internationalization';

import { getExpireOptions } from '../../ShareSnapshotTab';

import { ShareSnapshot } from './ShareSnapshot';

const SNAPSHOT_URL = 'https://grafana.com/docs/grafana/latest/dashboards/share-dashboards-panels/#publish-a-snapshot';

interface Props extends SceneComponentProps<ShareSnapshot> {
  onCreateClick: (isExternal?: boolean) => void;
  isLoading: boolean;
}
export function CreateSnapshot({ model, onCreateClick, isLoading }: Props) {
  const { snapshotName, selectedExpireOption, dashboardRef, snapshotSharingOptions } = model.useState();
  const styles = useStyles2(getStyles);

  const onCancelClick = () => {
    dashboardRef.resolve().closeModal();
  };

  return (
    <div className={styles.container}>
      <Alert severity="info" title={''}>
        <Stack justifyContent="space-between" gap={2} alignItems="center">
          <Text>
            <Trans i18nKey="snapshot.share.info-alert">
              A Grafana dashboard snapshot publicly shares a dashboard while removing sensitive data such as queries and
              panel links, leaving only visible metrics and series names. Anyone with the link can access the snapshot.
            </Trans>
          </Text>
          <Button variant="secondary" onClick={() => window.open(SNAPSHOT_URL, '_blank')} type="button">
            <Trans i18nKey="snapshot.share.learn-more-button">Learn more</Trans>
          </Button>
        </Stack>
      </Alert>
      <Field label={t('snapshot.share.name-label', 'Snapshot name*')}>
        <Input
          id="snapshot-name-input"
          defaultValue={snapshotName}
          onBlur={(e) => model.onSnasphotNameChange(e.target.value)}
        />
      </Field>
      <Field label={t('snapshot.share.expiration-label', 'Expires in')}>
        <RadioButtonGroup<number>
          id="expire-select-input"
          options={getExpireOptions()}
          value={selectedExpireOption?.value}
          onChange={model.onExpireChange}
        />
      </Field>
      <Divider />
      <Stack justifyContent="space-between" direction={{ xs: 'column', xl: 'row' }}>
        <Stack gap={1} flex={1} direction={{ xs: 'column', sm: 'row' }}>
          {snapshotSharingOptions?.externalEnabled && (
            <Button variant="secondary" disabled={isLoading} onClick={() => onCreateClick(true)}>
              {snapshotSharingOptions?.externalSnapshotName}
            </Button>
          )}
          <Button variant="primary" disabled={isLoading} onClick={() => onCreateClick()}>
            <Trans i18nKey="snapshot.share.local-button">Publish snapshot</Trans>
          </Button>
          <Button variant="secondary" fill="outline" onClick={onCancelClick}>
            <Trans i18nKey="snapshot.share.cancel-button">Cancel</Trans>
          </Button>
          {isLoading && <Spinner />}
        </Stack>
        <TextLink icon="external-link-alt" href="/dashboard/snapshots">
          {t('snapshot.share.view-all-button', 'View all snapshots')}
        </TextLink>
      </Stack>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    paddingBottom: theme.spacing(2),
  }),
});
