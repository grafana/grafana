import React, { FC, FormEvent, useCallback, useState } from 'react';
import { css, cx } from '@emotion/css';
import { CustomScrollbar, Icon, IconName, Input, useStyles2, useTheme2 } from '@grafana/ui';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { getSelectStyles } from '@grafana/ui/src/components/Select/getSelectStyles';
import { BuiltinRoleSelector } from './BuiltinRoleSelector';

const stopPropagation = (event: React.MouseEvent<HTMLDivElement>) => event.stopPropagation();

interface RolePickerMenuProps {
  builtInRole: string;
  options: Array<SelectableValue<string>>;
  onChange: (newRole: string) => void;
  // setValue: (newValue: any, action: any) => void;
  onBuiltinRoleChange: (newRole: string) => void;
  onClose: () => void;
}

export const RolePickerMenu: FC<RolePickerMenuProps> = (props) => {
  const theme = useTheme2();
  const styles = getSelectStyles(theme);
  const customStyles = useStyles2(getStyles);
  const { builtInRole, options, onChange, onBuiltinRoleChange } = props;
  console.log(props);

  return (
    <div className={cx(styles.menu, customStyles.menu)} aria-label="Role picker menu">
      <div className={customStyles.groupHeader}>Built-in roles</div>
      <BuiltinRoleSelector value={builtInRole} onChange={onBuiltinRoleChange} />
      <div className={styles.optionBody}></div>
      <div className={customStyles.groupHeader}>Custom roles</div>
      <CustomScrollbar autoHide={false} autoHeightMax="inherit" hideHorizontalTrack>
        <div className={styles.optionBody}>
          {options.map((option, i) => (
            <SelectMenuOptions data={option} key={i} />
          ))}
        </div>
      </CustomScrollbar>
    </div>
  );
};

interface SelectMenuOptionProps<T> {
  // isDisabled: boolean;
  isFocused?: boolean;
  isSelected?: boolean;
  // innerProps: any;
  data: SelectableValue<T>;
}

export const SelectMenuOptions = React.forwardRef<HTMLDivElement, React.PropsWithChildren<SelectMenuOptionProps<any>>>(
  (props, ref) => {
    const theme = useTheme2();
    const styles = getSelectStyles(theme);
    const { data, isFocused, isSelected } = props;

    return (
      <div
        ref={ref}
        className={cx(styles.option, isFocused && styles.optionFocused, isSelected && styles.optionSelected)}
        // {...innerProps}
        aria-label="Select option"
      >
        {data.icon && <Icon name={data.icon as IconName} className={styles.optionIcon} />}
        {data.imgUrl && <img className={styles.optionImage} src={data.imgUrl} />}
        <div className={styles.optionBody}>
          <span>{data.label}</span>
          {data.description && <div className={styles.optionDescription}>{data.description}</div>}
          {data.component && <data.component />}
        </div>
      </div>
    );
  }
);

SelectMenuOptions.displayName = 'SelectMenuOptions';

interface InputProps {
  role?: string;
  onChange: (role?: string) => void;
  onOpen: (event: FormEvent<HTMLElement>) => void;
}

export const RolePickerInput: FC<InputProps> = ({ role, onChange, onOpen }) => {
  const [internalRole] = useState(() => {
    return role;
  });

  const onFocus = useCallback(
    (event: FormEvent<HTMLElement>) => {
      onOpen(event);
    },
    [onOpen]
  );

  const onBlur = useCallback(() => {
    onChange(internalRole);
  }, [internalRole, onChange]);

  return (
    <Input
      onClick={stopPropagation}
      // onChange={onChangeDate}
      value={internalRole}
      onFocus={onFocus}
      onBlur={onBlur}
      data-testid="date-time-input"
      placeholder="Select date/time"
    />
  );
};

export const getStyles = (theme: GrafanaTheme2, isReversed = false) => {
  return {
    menu: css`
      max-height: 300px;
      position: absolute;
      z-index: ${theme.zIndex.dropdown};
      overflow: hidden;
    `,
    groupHeader: css`
      padding: ${theme.spacing(0, 1)};
      display: flex;
      align-items: center;
      color: ${theme.colors.primary.text};
    `,
    container: css`
      padding: ${theme.spacing(1)};
      border: 1px ${theme.colors.border.weak} solid;
      border-radius: ${theme.shape.borderRadius(1)};
      background-color: ${theme.colors.background.primary};
      z-index: ${theme.zIndex.modal};
    `,
  };
};
