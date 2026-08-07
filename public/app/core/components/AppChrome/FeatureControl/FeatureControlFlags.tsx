import { css } from '@emotion/css';
import { ClientProviderEvents } from '@openfeature/web-sdk';
import { useEffect, useState } from 'react';

import type { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { getLocalStorageProvider } from '@grafana/runtime/internal';
import { Alert, Button, Card, Dropdown, Icon, IconButton, Menu, MenuItem, Stack, Text, useStyles2 } from '@grafana/ui';
import { getPreviewAssetsFolder } from 'app/core/utils/previewAssets';

import { FeatureControlFlag, type FeatureControlFlagProps } from './FeatureControlFlag';
import { useFeatureControlContext } from './FeatureControlProvider';

const compare = new Intl.Collator('en', { sensitivity: 'base', numeric: true }).compare;

type Flag = NonNullable<FeatureControlFlagProps['flag']>;

export const FeatureControlFlags = () => {
  const { setIsOpen, setIsAccessible } = useFeatureControlContext();
  const [flags, setFlags] = useState<Flag[]>([]);
  const styles = useStyles2(getStyles);
  const previewAssetsFolder = getPreviewAssetsFolder();

  useEffect(() => {
    const loadFlags = () => {
      setFlags(
        Object.entries(getLocalStorageProvider().getFlags())
          .map(([key, value]) => ({ key, value }))
          .sort((a, b) => compare(a.key, b.key))
      );
    };
    loadFlags();

    getLocalStorageProvider().events.addHandler(ClientProviderEvents.ConfigurationChanged, loadFlags);
    return () => {
      getLocalStorageProvider().events.removeHandler(ClientProviderEvents.ConfigurationChanged, loadFlags);
    };
  }, []);

  return (
    <Card noMargin className={styles.card}>
      <Stack direction="row" alignItems="center">
        <Icon name="flask" size="xl" />
        <Text variant="h4">
          <Trans i18nKey="feature-control.title">Feature control</Trans>
        </Text>

        <Dropdown
          overlay={
            <Menu onOpen={(focusOnItem) => focusOnItem(-1)}>
              <MenuItem
                onClick={() => {
                  setIsOpen(false);
                  setIsAccessible(false);
                }}
                destructive
                icon="times"
                label={t('feature-control.dismiss.label', 'Remove UI and toolbar button')}
                component={() => (
                  <Text color="secondary" variant="bodySmall" textAlignment="start">
                    <Trans i18nKey="feature-control.dismiss.tooltip" values={{ param: '?featureControl=true' }}>
                      Any feature flag overrides defined will remain active.
                      <br /> Use <code>{'{{ param }}'}</code> in the URL to enable UI again.
                    </Trans>
                  </Text>
                )}
              />
            </Menu>
          }
          placement="bottom-start"
        >
          <IconButton
            tooltip={t('feature-control.menu', 'Open menu')}
            variant="secondary"
            name="bars"
            className={styles.menu}
          />
        </Dropdown>
      </Stack>
      <Text variant="body" color="secondary">
        <Trans i18nKey="feature-control.description">
          Override frontend feature flags locally for testing and development purposes.
        </Trans>
      </Text>

      {previewAssetsFolder && (
        <Alert
          severity="info"
          title={t('feature-control.preview-assets.title', 'Frontend preview active')}
          action={
            <Button
              size="sm"
              variant="secondary"
              // Must be a full page load so the request reaches the frontend
              // service instead of the SPA router
              onClick={() => window.location.assign('/-/set-preview-assets?clear=1')}
            >
              {t('feature-control.preview-assets.stop', 'Stop preview')}
            </Button>
          }
          className={styles.previewAlert}
        >
          <Trans i18nKey="feature-control.preview-assets.body" values={{ folder: previewAssetsFolder }}>
            This session is using frontend assets from the preview build <code>{'{{ folder }}'}</code> instead of the
            released frontend.
          </Trans>
        </Alert>
      )}

      <div className={styles.list}>
        {flags.map((flag) => (
          <FeatureControlFlag key={flag.key} flag={flag} />
        ))}
        <FeatureControlFlag />
      </div>
    </Card>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  card: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    width: theme.spacing(50),
    boxShadow: theme.shadows.z2,
    border: `1px solid ${theme.colors.border.medium}`,
  }),
  menu: css({
    marginLeft: 'auto',
  }),
  previewAlert: css({
    marginBottom: 0,
  }),
  list: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    margin: theme.spacing(0, 0, 1),
    width: '100%',
  }),
});
