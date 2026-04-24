import { css, cx } from '@emotion/css';
import { ClientProviderEvents } from '@openfeature/web-sdk';
import { type PointerEventHandler, useCallback, useEffect, useRef, useState } from 'react';

import type { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { getLocalStorageProvider, getOFREPWebProvider } from '@grafana/runtime/internal';
import {
  Card,
  Icon,
  Input,
  Stack,
  useStyles2,
  Text,
  Button,
  Badge,
  Field,
  Combobox,
  RadioButtonGroup,
  CodeEditor,
  type BadgeColor,
  type ComboboxOption,
} from '@grafana/ui';

import { useFeatureControlContext } from './FeatureControlProvider';

const compare = new Intl.Collator('en', { sensitivity: 'base', numeric: true }).compare;

const types = ['boolean', 'number', 'string', 'object'] as const;
type OpenFeatureType = (typeof types)[number];

type OpenFeatureFlag = {
  key: string;
  value: string;
};

const getFlagType = (value: string): OpenFeatureType => {
  if (value === 'true' || value === 'false') {
    return 'boolean';
  }

  const number = Number.parseFloat(value);
  if (!Number.isNaN(number)) {
    return 'number';
  }

  try {
    JSON.parse(value);
    return 'object';
  } catch {}

  return 'string';
};

const getBadgeText = (value: string): string => {
  const type = getFlagType(value);

  switch (type) {
    case 'boolean':
    case 'number':
    case 'string':
      return value;
    case 'object':
      return '{...}';
  }
};

const getBadgeColor = (value: string): BadgeColor => {
  const type = getFlagType(value);

  switch (type) {
    case 'boolean':
      return value === 'true' ? 'green' : 'red';
    case 'number':
      return 'orange';
    case 'string':
      return 'purple';
    case 'object':
      return 'blue';
  }
};

const FeatureControlKey = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => {
  const [keys, setKeys] = useState<Array<ComboboxOption<string>>>([]);

  useEffect(() => {
    const loadKeys = () => {
      setKeys(
        Object.keys(getOFREPWebProvider().flagCache)
          .sort((a, b) => compare(a, b))
          .map((k) => ({ label: k, value: k }))
      );
    };
    loadKeys();

    getOFREPWebProvider().events.addHandler(ClientProviderEvents.ConfigurationChanged, loadKeys);
    return () => {
      getOFREPWebProvider().events.removeHandler(ClientProviderEvents.ConfigurationChanged, loadKeys);
    };
  }, []);

  return (
    <Combobox
      options={keys}
      value={value}
      aria-label={t('feature-control.flag-key', 'Flag key')}
      placeholder={t('feature-control.flag-key-placeholder', 'my-component.my-flag')}
      onChange={(v) => onChange(v.value)}
      createCustomValue
    />
  );
};

const FeatureControlFlag = ({ flag }: { flag?: OpenFeatureFlag }) => {
  const styles = useStyles2(getStyles);
  const ref = useRef<HTMLDetailsElement>(null);
  const [key, setKey] = useState('');
  const [value, setValue] = useState('true');
  const [json, setJson] = useState('true');
  const [type, setType] = useState<OpenFeatureType>('boolean');
  const [error, setError] = useState<string>();

  const reset = useCallback(() => {
    setKey(flag?.key ?? '');
    setValue(flag?.value ?? 'true');
    setJson(() => {
      try {
        return JSON.stringify(JSON.parse(flag?.value ?? 'true'), null, 2);
      } catch {
        return flag?.value ?? 'true';
      }
    });
    setType(flag ? getFlagType(flag.value) : 'boolean');
    setError(undefined);
  }, [flag]);

  useEffect(() => {
    reset();
  }, [reset]);

  const changeType = (newType: OpenFeatureType) => {
    setType(newType);

    const newValue = (() => {
      switch (newType) {
        case 'boolean':
          return ['false', '0', ''].includes(value) ? 'false' : 'true';
        case 'number':
          return !Number.isNaN(Number.parseFloat(value)) ? value : '0';
        case 'string':
          return value;
        case 'object':
          try {
            return JSON.stringify(JSON.parse(value), null, 2);
          } catch {
            return JSON.stringify(value, null, 2);
          }
      }
    })();

    setValue(newValue);
    setJson(newValue);
  };

  const changeJson = (newJson: string) => {
    setJson(newJson);

    try {
      setValue(JSON.stringify(JSON.parse(newJson)));
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <details ref={ref} className={styles.details}>
      <summary onClick={reset}>
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
                    {getBadgeText(flag.value)}
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
        {flag ? (
          <Field noMargin disabled>
            <Input
              value={key}
              aria-label={t('feature-control.flag-key', 'Flag key')}
              placeholder={t('feature-control.flag-key-placeholder', 'my-component.my-flag')}
            />
          </Field>
        ) : (
          <Field noMargin>
            <FeatureControlKey value={key} onChange={setKey} />
          </Field>
        )}

        <Stack direction="row" gap={1} alignItems="center">
          <Combobox
            options={types.map((t) => ({ label: t, value: t }))}
            value={type}
            onChange={(v) => changeType(v.value)}
          />

          <Button
            icon="save"
            onClick={() => {
              getLocalStorageProvider().setFlags({ [key]: value });
              if (!flag) {
                reset();
                if (ref.current) {
                  ref.current.open = false;
                }
              }
            }}
            disabled={flag?.value === value || !key.trim()}
          >
            <Trans i18nKey="feature-control.save-flag">Save</Trans>
          </Button>

          <Button
            icon="trash-alt"
            variant="destructive"
            onClick={() => {
              getLocalStorageProvider().setFlags({ [key]: undefined });
            }}
            disabled={!flag}
          >
            <Trans i18nKey="feature-control.delete-flag">Delete</Trans>
          </Button>
        </Stack>

        {type === 'boolean' && (
          <Field noMargin>
            <RadioButtonGroup
              options={[
                { label: 'true', value: 'true' },
                { label: 'false', value: 'false' },
              ]}
              value={value}
              onChange={setValue}
              fullWidth
            />
          </Field>
        )}

        {(type === 'number' || type === 'string') && (
          <Field noMargin>
            <Input
              type={type === 'number' ? 'number' : 'text'}
              value={value}
              aria-label={t('feature-control.flag-value', 'Flag value')}
              onChange={(e) => setValue(e.currentTarget.value)}
            />
          </Field>
        )}

        {type === 'object' && (
          <Field noMargin error={error} invalid={!!error}>
            <CodeEditor value={json} onChange={changeJson} language="json" height={80} />
          </Field>
        )}
      </div>
    </details>
  );
};

type FeatureControlFlagsProps = {
  className?: string;
  onPointerDown?: PointerEventHandler<HTMLDivElement>;
};

export const FeatureControlFlags = ({ className, onPointerDown }: FeatureControlFlagsProps) => {
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
    <Card noMargin className={cx(styles.card, className)} onPointerDown={onPointerDown}>
      <div className={styles.header}>
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
      </div>

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
    boxShadow: theme.shadows.z2,
    border: `1px solid ${theme.colors.border.medium}`,
  }),
  header: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    pointerEvents: 'none',
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
