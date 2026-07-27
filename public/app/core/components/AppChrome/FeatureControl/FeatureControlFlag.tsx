import { css } from '@emotion/css';
import { ClientProviderEvents } from '@openfeature/web-sdk';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import type { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { getLocalStorageProvider, getOFREPWebProvider } from '@grafana/runtime/internal';
import {
  Badge,
  type BadgeColor,
  Button,
  CodeEditor,
  Combobox,
  type ComboboxOption,
  Field,
  Input,
  RadioButtonGroup,
  Stack,
  Text,
  useStyles2,
} from '@grafana/ui';

const compare = new Intl.Collator('en', { sensitivity: 'base', numeric: true }).compare;

export type FeatureControlFlagProps = {
  flag?: {
    key: string;
    value: string;
  };
};

const types = ['boolean', 'number', 'string', 'object'] as const;
type FeatureControlFlagType = (typeof types)[number];

const getFlagType = (value: string): FeatureControlFlagType => {
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
  const id = useId();

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
    <Field
      label={
        <label htmlFor={`${id}-key`} className="sr-only">
          <Trans i18nKey="feature-control.flag-key">Flag key</Trans>
        </label>
      }
      noMargin
    >
      <Combobox
        id={`${id}-key`}
        options={keys}
        value={value}
        placeholder={t('feature-control.flag-key-placeholder', 'my-component.my-flag')}
        onChange={(v) => onChange(v.value)}
        createCustomValue
      />
    </Field>
  );
};

export const FeatureControlFlag = ({ flag }: FeatureControlFlagProps) => {
  const styles = useStyles2(getStyles);
  const ref = useRef<HTMLDetailsElement>(null);
  const [key, setKey] = useState('');
  const [value, setValue] = useState('true');
  const [json, setJson] = useState('true');
  const [type, setType] = useState<FeatureControlFlagType>('boolean');
  const [error, setError] = useState<string>();
  const id = useId();

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

  const changeType = (newType: FeatureControlFlagType) => {
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
          <FeatureControlKey value={key} onChange={setKey} />
        )}

        <Stack direction="row" gap={1} alignItems="center">
          <Field
            label={
              <label htmlFor={`${id}-type`} className="sr-only">
                <Trans i18nKey="feature-control.flag-type">Flag type</Trans>
              </label>
            }
            noMargin
          >
            <Combobox
              id={`${id}-type`}
              options={types.map((t) => ({ label: t, value: t }))}
              value={type}
              onChange={(v) => changeType(v.value)}
            />
          </Field>

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
          <Field
            label={
              <span className="sr-only">
                <Trans i18nKey="feature-control.flag-value">Flag value</Trans>
              </span>
            }
            noMargin
          >
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
          <Field
            label={
              <label htmlFor={`${id}-value`} className="sr-only">
                <Trans i18nKey="feature-control.flag-value">Flag value</Trans>
              </label>
            }
            noMargin
          >
            <Input
              id={`${id}-value`}
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
