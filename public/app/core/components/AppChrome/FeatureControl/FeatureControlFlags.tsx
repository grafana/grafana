import { css } from '@emotion/css';
import { useState } from 'react';

import type { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, Card, Icon, IconButton, Stack, Text, useStyles2 } from '@grafana/ui';
import { getPreviewAssetsFolder } from 'app/core/utils/previewAssets';

import { FeatureControlFlag } from './FeatureControlFlag';
import { FeatureControlMenu } from './FeatureControlMenu';
import { useFeatureControlContext } from './FeatureControlProvider';
import { PreviewAssetsMessage } from './PreviewAssetsMessage';

export const FeatureControlFlags = () => {
  const { setIsOpen, overrides, isSuspended } = useFeatureControlContext();
  const styles = useStyles2(getStyles);
  const previewAssetsFolder = getPreviewAssetsFolder();
  const [showNewForm, setShowNewForm] = useState(false);

  return (
    <Card noMargin className={styles.card}>
      <Stack direction="row" alignItems="center">
        <Icon name="flask" size="xl" />
        <Text variant="h4">
          <Trans i18nKey="feature-control.title">Feature control</Trans>
        </Text>

        <div className={styles.headerActions}>
          <FeatureControlMenu />
          <IconButton
            tooltip={t('feature-control.close', 'Close')}
            variant="secondary"
            name="times"
            onClick={() => setIsOpen(false)}
          />
        </div>
      </Stack>
      <Text variant="body" color="secondary">
        <Trans i18nKey="feature-control.description">
          Override frontend feature flags locally for testing and development purposes.
        </Trans>
      </Text>

      {isSuspended && (
        <div className={styles.suspendedStatus} role="status">
          <Icon name="exclamation-triangle" className={styles.suspendedIcon} />
          <div className={styles.suspendedText}>
            <Text variant="bodySmall" weight="medium">
              <Trans i18nKey="feature-control.suspended-warning">Overrides are temporarily disabled</Trans>
            </Text>
            <Text variant="bodySmall" color="secondary">
              <Trans i18nKey="feature-control.suspended-warning-body">
                Flags are evaluating to their default values. Restore overrides to re-enable them.
              </Trans>
            </Text>
          </div>
        </div>
      )}

      {previewAssetsFolder && <PreviewAssetsMessage previewAssetsFolder={previewAssetsFolder} />}

      <div className={styles.list}>
        {overrides.map((flag) => (
          <FeatureControlFlag key={flag.key} flag={flag} disabled={isSuspended} />
        ))}
        {showNewForm && !isSuspended && <FeatureControlFlag autoFocus onDone={() => setShowNewForm(false)} />}
      </div>

      {!showNewForm && !isSuspended && (
        <Button icon="plus" variant="secondary" fullWidth onClick={() => setShowNewForm(true)}>
          {t('feature-control.add-new-flag', 'Add new flag override')}
        </Button>
      )}
    </Card>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  card: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    width: theme.spacing(64),
    boxShadow: theme.shadows.z2,
    border: `1px solid ${theme.colors.border.medium}`,
  }),
  headerActions: css({
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  }),
  suspendedStatus: css({
    display: 'grid',
    gridTemplateColumns: 'auto minmax(0, 1fr)',
    gap: theme.spacing(1),
    alignItems: 'center',
    padding: theme.spacing(1),
    backgroundColor: theme.colors.background.secondary,
    borderLeft: `3px solid ${theme.colors.warning.border}`,
    borderRadius: theme.shape.radius.default,
  }),
  suspendedIcon: css({
    color: theme.colors.warning.text,
  }),
  suspendedText: css({
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  }),
  list: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    margin: theme.spacing(0, 0, 1),
    width: '100%',
  }),
});
