import { css, cx } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ConfirmButton, Input, Label, LegacyInputStatus, useStyles2 } from '@grafana/ui';

interface Props {
  label: string;
  value?: string;
  inputType?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
}

export const ServiceAccountProfileRow = ({ label, value, inputType, disabled, onChange }: Props): JSX.Element => {
  const inputElem = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState(value);
  const [isEditing, setIsEditing] = useState(false);
  const styles = useStyles2(getStyles);
  const inputId = `${label}-input`;

  useEffect(() => {
    if (isEditing) {
      focusInput();
    }
  }, [isEditing]);

  const onEditClick = () => {
    setIsEditing(true);
  };

  const onCancelClick = () => {
    setIsEditing(false);
    setInputValue(value || '');
  };

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>, status?: LegacyInputStatus) => {
    if (status === LegacyInputStatus.Invalid) {
      return;
    }
    setInputValue(event.target.value);
  };

  const onInputBlur = (event: React.FocusEvent<HTMLInputElement>, status?: LegacyInputStatus) => {
    if (status === LegacyInputStatus.Invalid) {
      return;
    }
    setInputValue(event.target.value);
  };

  const focusInput = () => {
    inputElem?.current?.focus();
  };

  const onSave = () => {
    setIsEditing(false);
    if (onChange) {
      onChange(inputValue!);
    }
  };

  return (
    <tr>
      <td>
        <Label htmlFor={inputId}>{label}</Label>
      </td>
      <td className="width-25" colSpan={2}>
        {!disabled && isEditing ? (
          <Input
            id={inputId}
            type={inputType}
            defaultValue={value}
            onBlur={onInputBlur}
            onChange={onInputChange}
            ref={inputElem}
            width={30}
          />
        ) : (
          <span className={cx({ [styles.disabled]: disabled })}>{value}</span>
        )}
      </td>
      <td>
        {onChange && (
          <ConfirmButton
            closeOnConfirm
            confirmText={t('serviceaccounts.service-account-profile-row.confirmText-save', 'Save')}
            onConfirm={onSave}
            onClick={onEditClick}
            onCancel={onCancelClick}
            disabled={disabled}
          >
            {t('serviceaccounts.service-account-profile-row.edit', 'Edit')}
          </ConfirmButton>
        )}
      </td>
    </tr>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    disabled: css({
      color: theme.colors.text.secondary,
    }),
  };
};
