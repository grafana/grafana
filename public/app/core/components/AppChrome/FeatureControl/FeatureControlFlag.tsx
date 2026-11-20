import { css, cx } from '@emotion/css';
import { ClientProviderEvents } from '@openfeature/web-sdk';
import { useCallback, useEffect, useId, useState } from 'react';

import type { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { FlagKeys, getLocalStorageProvider, getOFREPWebProvider } from '@grafana/runtime/internal';
import {
  Badge,
  type BadgeColor,
  Button,
  Combobox,
  type ComboboxOption,
  Field,
  Icon,
  Input,
  RadioButtonGroup,
  Stack,
  Text,
  Tooltip,
  useStyles2,
} from '@grafana/ui';
import { CodeMirrorEditor } from '@grafana/ui/unstable';

type OFREPEvaluationResult = ReturnType<typeof getOFREPWebProvider>['flagCache'][string];

const compare = new Intl.Collator('en', { sensitivity: 'base', numeric: true }).compare;

export type FeatureControlFlagProps = {
  flag?: {
    key: string;
    value: string;
  };
  /** Autofocus the key input (used when revealing the new-flag form). */
  autoFocus?: boolean;
  /** Called after a new flag is saved so the caller can hide the form. */
  onDone?: () => void;
  /** Render the row greyed out and non-interactive (e.g. while overrides are suspended). */
  disabled?: boolean;
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

const getEvaluationValueText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }

  return String(value);
};

const FeatureControlKey = ({
  value,
  onChange,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}) => {
  const [keys, setKeys] = useState<Array<ComboboxOption<string>>>([]);
  const id = useId();

  useEffect(() => {
    const loadKeys = () => {
      setKeys(
        [...new Set(Object.keys(getOFREPWebProvider().flagCache).concat(Object.values(FlagKeys)))]
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
        autoFocus={autoFocus}
      />
    </Field>
  );
};

const useOFREPResult = (key: string): OFREPEvaluationResult | undefined => {
  const [result, setResult] = useState<OFREPEvaluationResult>();

  useEffect(() => {
    const loadResult = () => {
      setResult(getOFREPWebProvider().flagCache[key]);
    };
    loadResult();

    getOFREPWebProvider().events.addHandler(ClientProviderEvents.ConfigurationChanged, loadResult);
    return () => {
      getOFREPWebProvider().events.removeHandler(ClientProviderEvents.ConfigurationChanged, loadResult);
    };
  }, [key]);

  return result;
};

// Shows whether an override matches the evaluated value, differs from it, or sets
// a value for a flag that the provider does not currently evaluate.
const FeatureControlOverrideStatus = ({ flagKey, overrideValue }: { flagKey: string; overrideValue: string }) => {
  const styles = useStyles2(getStyles);
  const result = useOFREPResult(flagKey);

  const status = (() => {
    if (!result || 'errorCode' in result) {
      return {
        tooltip: t('feature-control.override-status.new', 'Setting a value that is not otherwise evaluated'),
        icon: 'exclamation-triangle',
        className: styles.statusNew,
      } as const;
    }

    if (getEvaluationValueText(result.value) === overrideValue) {
      return {
        tooltip: t('feature-control.override-status.same', 'Matches the evaluated value'),
        icon: 'check-circle',
        className: styles.statusSame,
      } as const;
    }

    return {
      tooltip: t('feature-control.override-status.different', 'Differs from the evaluated value'),
      icon: 'info-circle',
      className: styles.statusDifferent,
    } as const;
  })();

  return (
    <Tooltip content={status.tooltip}>
      <Icon name={status.icon} size="sm" className={status.className} />
    </Tooltip>
  );
};

const FeatureControlOFREP = ({ value }: { value: string }) => {
  const styles = useStyles2(getStyles);
  const result = useOFREPResult(value);

  if (!result) {
    return null;
  }

  const hasError = 'errorCode' in result;
  const badgeText = hasError ? (result.errorCode ?? 'Error') : getEvaluationValueText(result.value);
  const badgeColor = hasError ? 'red' : getBadgeColor(badgeText);
  const info = hasError
    ? result.errorDetails
    : (result.variant || result.reason) && (
        <Stack direction="column" gap={0.5}>
          {result.variant && (
            <Text variant="bodySmall" color="secondary">
              <Trans i18nKey="feature-control.ofrep-variant" values={{ variant: result.variant }}>
                Variant:{' '}
                <Text variant="code" color="primary">
                  {'{{variant}}'}
                </Text>
              </Trans>
            </Text>
          )}
          {result.reason && (
            <Text variant="bodySmall" color="secondary">
              <Trans i18nKey="feature-control.ofrep-reason" values={{ reason: result.reason }}>
                Reason:{' '}
                <Text variant="code" color="primary">
                  {'{{reason}}'}
                </Text>
              </Trans>
            </Text>
          )}
        </Stack>
      );

  return (
    <Stack direction="row" gap={1} alignItems="center">
      <Text color="secondary" variant="bodySmall">
        <Stack direction="row" gap={0.5} alignItems="center">
          <Trans i18nKey="feature-control.ofrep-evaluation">OFREP evaluation</Trans>
          {info && (
            <Tooltip content={info}>
              <Icon name="info-circle" size="sm" />
            </Tooltip>
          )}
        </Stack>
      </Text>

      <div className={styles.line} />

      <Badge
        color={badgeColor}
        text={
          <Text variant="code" truncate>
            {getBadgeText(badgeText)}
          </Text>
        }
        tooltip={getBadgeText(badgeText) === badgeText ? undefined : <Text variant="code">{badgeText}</Text>}
      />
    </Stack>
  );
};

export const FeatureControlFlag = ({ flag, autoFocus, onDone, disabled }: FeatureControlFlagProps) => {
  const styles = useStyles2(getStyles);
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

  const body = (
    <div className={styles.fields}>
      {!flag && <FeatureControlKey value={key} onChange={setKey} autoFocus={autoFocus} />}
      {key && <FeatureControlOFREP value={key} />}

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
            width="auto"
            minWidth={12}
            options={types.map((t) => ({ label: t, value: t }))}
            value={type}
            onChange={(v) => changeType(v.value)}
          />
        </Field>

        {type === 'boolean' && (
          <Field
            className={styles.valueField}
            label={
              <span id={`${id}-value-label`} className="sr-only">
                <Trans i18nKey="feature-control.flag-value">Flag value</Trans>
              </span>
            }
            useFieldset={false}
            noMargin
          >
            <RadioButtonGroup
              aria-labelledby={`${id}-value-label`}
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
            className={styles.valueField}
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
              onChange={(e) => setValue(e.currentTarget.value)}
            />
          </Field>
        )}
      </Stack>

      {type === 'object' && (
        <Field
          label={
            <span id={`${id}-value-label`} className="sr-only">
              <Trans i18nKey="feature-control.flag-value">Flag value</Trans>
            </span>
          }
          noMargin
          error={error}
          invalid={!!error}
        >
          <CodeMirrorEditor
            value={json}
            onChange={changeJson}
            language="json"
            height="80px"
            aria-labelledby={`${id}-value-label`}
          />
        </Field>
      )}

      <Stack direction="row" gap={1} alignItems="center">
        <Button
          className={styles.actionButton}
          fullWidth
          icon="save"
          onClick={() => {
            getLocalStorageProvider().setFlags({ [key]: value });
            if (!flag) {
              reset();
              onDone?.();
            }
          }}
          disabled={flag?.value === value || !key.trim()}
        >
          <Trans i18nKey="feature-control.save-flag">Save</Trans>
        </Button>

        {flag ? (
          <Button
            className={styles.actionButton}
            fullWidth
            icon="trash-alt"
            variant="destructive"
            onClick={() => {
              getLocalStorageProvider().setFlags({ [key]: undefined });
            }}
          >
            <Trans i18nKey="feature-control.delete-flag">Delete</Trans>
          </Button>
        ) : (
          <Button className={styles.actionButton} fullWidth variant="secondary" onClick={() => onDone?.()}>
            <Trans i18nKey="feature-control.cancel-flag">Cancel</Trans>
          </Button>
        )}
      </Stack>
    </div>
  );

  // No flag yet means this is the inline "add new override" form, which is always
  // open; an existing override renders as a collapsible row.
  if (!flag) {
    return <div className={styles.openForm}>{body}</div>;
  }

  return (
    <details className={cx(styles.details, disabled && styles.disabled)} aria-disabled={disabled || undefined}>
      <summary onClick={reset}>
        <Stack direction="row" gap={1} alignItems="center">
          <div className={styles.flagKey}>
            <Text variant="code">{flag.key}</Text>
          </div>
          <div className={styles.line} />
          <Badge
            color={getBadgeColor(flag.value)}
            text={<Text variant="code">{getBadgeText(flag.value)}</Text>}
            tooltip={getBadgeText(flag.value) === flag.value ? undefined : <Text variant="code">{flag.value}</Text>}
          />
          <FeatureControlOverrideStatus flagKey={flag.key} overrideValue={flag.value} />
        </Stack>
      </summary>
      {body}
    </details>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  disabled: css({
    opacity: 0.5,
    pointerEvents: 'none',
  }),
  valueField: css({
    flex: '1 1 0',
    minWidth: 0,
  }),
  actionButton: css({
    flex: '1 1 0',
  }),
  flagKey: css({
    flex: '0 1 auto',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  statusSame: css({
    color: theme.colors.success.text,
  }),
  statusDifferent: css({
    color: theme.colors.info.text,
  }),
  statusNew: css({
    color: theme.colors.warning.text,
  }),
  details: css({
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    backgroundColor: theme.colors.background.secondary,
    padding: theme.spacing(1),

    '&[open]': {
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    },

    '> summary': {
      listStyle: 'none',
      cursor: 'pointer',
      padding: theme.spacing(1),
      margin: theme.spacing(-1),
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

    '&[open] > summary': {
      marginBottom: 0,
    },
  }),
  openForm: css({
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    backgroundColor: theme.colors.background.secondary,
    padding: theme.spacing(1),
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
  line: css({
    flex: 1,
    height: '1px',
    backgroundColor: theme.colors.border.medium,
  }),
});
