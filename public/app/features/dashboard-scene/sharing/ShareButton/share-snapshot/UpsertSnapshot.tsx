import { css } from '@emotion/css';
import { PropsWithChildren } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { SceneObjectRef, VizPanel } from '@grafana/scenes';
import { Alert, Button, Divider, Field, Input, RadioButtonGroup, Stack, Text, useStyles2 } from '@grafana/ui';

import { getExpireOptions } from '../../ShareSnapshotTab';

const DASHBOARD_SNAPSHOT_URL =
  'https://grafana.com/docs/grafana/next/dashboards/share-dashboards-panels/#share-a-snapshot';

const PANEL_SNAPSHOT_URL = 'https://grafana.com/docs/grafana/next/dashboards/share-dashboards-panels/#panel-snapshot';

interface Props {
  name: string;
  selectedExpireOption: SelectableValue<number>;
  onNameChange: (v: string) => void;
  onExpireChange: (v: number) => void;
  panelRef?: SceneObjectRef<VizPanel>;
  disableInputs: boolean;
}
export function UpsertSnapshot({
  name,
  onNameChange,
  onExpireChange,
  selectedExpireOption,
  panelRef,
  disableInputs,
  children,
}: Props & PropsWithChildren) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <Alert severity="info" title={''}>
        <Stack justifyContent="space-between" gap={2} alignItems="center">
          <Text>
            {panelRef ? (
              <Trans i18nKey="snapshot.share-panel.info-alert">
                A Grafana panel snapshot publicly shares a panel while removing sensitive data such as queries and panel
                links, leaving only visible metrics and series names. Anyone with the link can access the snapshot.
              </Trans>
            ) : (
              <Trans i18nKey="snapshot.share.info-alert">
                A Grafana dashboard snapshot publicly shares a dashboard while removing sensitive data such as queries
                and panel links, leaving only visible metrics and series names. Anyone with the link can access the
                snapshot.
              </Trans>
            )}
          </Text>
          <Button
            variant="secondary"
            onClick={() => window.open(panelRef ? PANEL_SNAPSHOT_URL : DASHBOARD_SNAPSHOT_URL, '_blank')}
            type="button"
          >
            <Trans i18nKey="snapshot.share.learn-more-button">Learn more</Trans>
          </Button>
        </Stack>
      </Alert>
      <fieldset disabled={disableInputs}>
        <Field label={t('snapshot.share.name-label', 'Snapshot name')}>
          <Input id="snapshot-name-input" value={name} onChange={(e) => onNameChange(e.currentTarget.value)} />
        </Field>
        <Field label={t('snapshot.share.expiration-label', 'Expires in')}>
          <RadioButtonGroup<number>
            id="expire-select-input"
            options={getExpireOptions()}
            value={selectedExpireOption?.value}
            onChange={onExpireChange}
          />
        </Field>
      </fieldset>
      <Divider />
      {children}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    paddingBottom: theme.spacing(2),
  }),
});
