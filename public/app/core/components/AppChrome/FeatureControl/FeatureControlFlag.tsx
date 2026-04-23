import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import type { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { getLocalStorageProvider } from '@grafana/runtime/internal';
import { Badge, Field, IconButton, Input, Stack, Text, useStyles2 } from '@grafana/ui';

export type FeatureControlFlagProps = {
  flag?: {
    key: string;
    value: string;
  };
};

const getBadgeColor = (value: string) => {
  if (value === 'true') {
    return 'green';
  }
  if (value === 'false') {
    return 'red';
  }
  return 'blue';
};

export const FeatureControlFlag = ({ flag }: FeatureControlFlagProps) => {
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

const getStyles = (theme: GrafanaTheme2) => ({
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
