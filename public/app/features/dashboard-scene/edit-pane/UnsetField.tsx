import { css } from '@emotion/css';
import { useToggle } from 'react-use';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Button, Field, Label, useStyles2 } from '@grafana/ui';

export interface UnsetFieldProps<T> {
  value: T;
  defaultValue?: T;
  label: string;
  description?: string;
  children: (onValueChanged: (value: T) => void, autoFocus: boolean) => React.ReactElement;
}

export function UnsetField<T>({ value, defaultValue, children, label }: UnsetFieldProps<T>) {
  const styles = useStyles2(getUnsetFieldStyles);
  const [isSetting, setIsSetting] = useToggle(false);

  if (isDefault(value, defaultValue) && !isSetting) {
    return (
      <div className={styles.wrapper}>
        <Label>{label}</Label>
        <div className={styles.button}>
          <Button size="sm" fill="text" icon="plus" onClick={setIsSetting}>
            <Trans i18nKey="dashboard.edit-pane.set-option-button">Set</Trans>
          </Button>
        </div>
      </div>
    );
  }

  const onValueChanged = (newValue: T | null | undefined) => {
    if (isDefault(newValue, defaultValue)) {
      setIsSetting();
    }
  };

  return <Field label={label}>{children(onValueChanged, isDefault(value, defaultValue))}</Field>;
}

function isDefault<T>(value: T | null | undefined, defaultValue: T | null | undefined) {
  if (defaultValue == null && (value == null || value === '')) {
    return true;
  }

  return defaultValue === value;
}

export function getUnsetFieldStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing(2),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      label: {
        color: theme.colors.text.secondary,
        marginBottom: 0,
      },
      position: 'relative',
    }),
    button: css({
      position: 'absolute',
      right: theme.spacing(0),
    }),
  };
}
