import { css } from '@emotion/css';

import type { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Card, Dropdown, IconButton, Menu, MenuItem, Stack, Text, useStyles2 } from '@grafana/ui';

import { BubblingFlask } from './BubblingFlask';
import { FeatureControlFlag } from './FeatureControlFlag';
import { useFeatureControlContext } from './FeatureControlProvider';
import { useFeatureFlagOverrides } from './useFeatureFlagOverrides';

export const FeatureControlFlags = () => {
  const { setIsOpen, setIsAccessible } = useFeatureControlContext();
  const flags = useFeatureFlagOverrides();
  const styles = useStyles2(getStyles);

  return (
    <Card noMargin className={styles.card}>
      <Stack direction="row" alignItems="center">
        <BubblingFlask bubbling={flags.length > 0} size="xl" />
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
                icon="trash-alt"
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
  list: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    margin: theme.spacing(0, 0, 1),
    width: '100%',
  }),
});
