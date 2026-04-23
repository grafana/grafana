import { css } from '@emotion/css';
import { ClientProviderEvents } from '@openfeature/web-sdk';
import { useEffect, useState } from 'react';

import type { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { getLocalStorageProvider } from '@grafana/runtime/internal';
import { Card, Icon, IconButton, Input, Stack, useStyles2, Text, Button, Badge, Field } from '@grafana/ui';

import { useFeatureControlContext } from './FeatureControlProvider';

const compare = new Intl.Collator('en', { sensitivity: 'base', numeric: true }).compare;

type OpenFeatureFlag = {
  key: string;
  value: string;
};

const getBadgeColor = (value: OpenFeatureFlag['value']) => {
  if (value === 'true') {
    return 'green';
  }
  if (value === 'false') {
    return 'red';
  }
  return 'blue';
};

const FeatureControlFlag = ({ flag }: { flag?: OpenFeatureFlag }) => {
  const styles = useStyles2(getStyles);
  const [key, setKey] = useState(flag?.key ?? '');
  const [value, setValue] = useState(flag?.value ?? '');

  useEffect(() => {
    setValue(flag?.key ?? '');
  }, [flag?.key]);

  useEffect(() => {
    setValue(flag?.value ?? '');
  }, [flag?.value]);

  return (
    <details className={styles.details}>
      <summary>
        <Stack direction="row" gap={1} alignItems="center" justifyContent="space-between">
          {flag ? (
            <>
              <Text variant="code" truncate>
                {flag.key}
              </Text>
              <Badge
                color={getBadgeColor(flag.value)}
                text={
                  <Text variant="code" truncate>
                    {flag.value}
                  </Text>
                }
              />
            </>
          ) : (
            <>
              <Text variant="code" color="secondary" truncate>
                <Trans i18nKey="feature-control.new-flag">new-flag-override</Trans>
              </Text>
              <Badge icon="plus" color="darkgrey" />
            </>
          )}
        </Stack>
      </summary>

      <div className={styles.fields}>
        <Field noMargin disabled={!!flag}>
          <Input
            value={key}
            aria-label={t('feature-control.flag-key', 'Flag key')}
            placeholder={t('feature-control.flag-key-placeholder', 'my-component.my-flag')}
            onChange={(e) => setKey(e.currentTarget.value)}
          />
        </Field>

        <Field noMargin>
          <Input
            value={value}
            aria-label={t('feature-control.flag-value', 'Flag value')}
            placeholder={t('feature-control.flag-value-placeholder', 'true, false, a string, number, or JSON')}
            onChange={(e) => setValue(e.currentTarget.value)}
          />
        </Field>

        <Stack direction="row" gap={1}>
          <IconButton
            name="save"
            size="lg"
            tooltip={t('feature-control.save-flag', 'Save override')}
            onClick={() => {
              getLocalStorageProvider().setFlags({ [key]: value });
              if (!flag) {
                setKey('');
                setValue('');
              }
            }}
            disabled={value === flag?.value || !value.trim() || !key.trim()}
            variant="primary"
          />

          <IconButton
            name="trash-alt"
            size="lg"
            tooltip={t('feature-control.delete-flag', 'Delete override')}
            onClick={() => {
              getLocalStorageProvider().setFlags({ [key]: undefined });
            }}
            disabled={!flag}
            variant="destructive"
          />
        </Stack>
      </div>
    </details>
  );
};

export const FeatureControlFlags = () => {
  const { setIsOpen, setIsAccessible } = useFeatureControlContext();
  const [flags, setFlags] = useState<OpenFeatureFlag[]>([]);
  const styles = useStyles2(getStyles);

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

      <Button
        size="sm"
        variant="destructive"
        fill="outline"
        fullWidth
        onClick={() => {
          setIsOpen(false);
          setIsAccessible(false);
        }}
        tooltip={
          <Trans i18nKey="feature-control.dismiss-tooltip" values={{ param: '?featureControl=true' }}>
            Removes the feature control UI and toolbar button. Use <code>{'{{ param }}'}</code> in the URL to enable it
            again. Any overrides defined will remain active.
          </Trans>
        }
      >
        <Trans i18nKey="feature-control.dismiss">Dismiss feature control</Trans>
      </Button>
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
  list: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    margin: theme.spacing(0, 0, 1),
    width: '100%',
  }),
  details: css({
    '&[open]': {
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    },

    '> summary': {
      listStyle: 'none',
      cursor: 'pointer',
      padding: theme.spacing(1),
      margin: theme.spacing(-0.5, -1),
      borderRadius: theme.shape.radius.sm,

      '&:hover': {
        backgroundColor: theme.colors.background.primary,
      },

      '&::-webkit-details-marker': {
        display: 'none',
      },

      span: {
        lineHeight: 1.5,
      },
    },
  }),
  fields: css({
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),

    input: {
      fontFamily: theme.typography.code.fontFamily,
      fontSize: theme.typography.code.fontSize,
    },
  }),
});
