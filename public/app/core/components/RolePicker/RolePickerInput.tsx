import { css, cx } from '@emotion/css';
import { FormEvent, HTMLProps, useEffect, useRef } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { useStyles2, getInputStyles, sharedInputStyle, Tooltip, Icon, Spinner } from '@grafana/ui';
import { getFocusStyles } from '@grafana/ui/internal';
import { Role } from 'app/types/accessControl';

import { ValueContainer } from './ValueContainer';
import { ROLE_PICKER_WIDTH } from './constants';

const stopPropagation = (event: React.MouseEvent<HTMLDivElement>) => event.stopPropagation();

interface InputProps extends HTMLProps<HTMLInputElement> {
  appliedRoles: Role[];
  basicRole?: string;
  query: string;
  showBasicRole?: boolean;
  isFocused?: boolean;
  disabled?: boolean;
  width?: string;
  isLoading?: boolean;
  onQueryChange: (query?: string) => void;
  onOpen: (event: FormEvent<HTMLElement>) => void;
  onClose: () => void;
}

export const RolePickerInput = ({
  appliedRoles,
  basicRole,
  disabled,
  isFocused,
  query,
  showBasicRole,
  width,
  isLoading,
  onOpen,
  onClose,
  onQueryChange,
  ...rest
}: InputProps): JSX.Element => {
  const styles = useStyles2(getRolePickerInputStyles, false, !!isFocused, !!disabled, false, width);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isFocused) {
      inputRef.current?.focus();
    }
  });

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target?.value;
    onQueryChange(query);
  };

  const showBasicRoleOnLabel = showBasicRole && basicRole !== 'None';

  return !isFocused ? (
    // TODO: fix keyboard a11y
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div className={cx(styles.wrapper, styles.selectedRoles)} onMouseDown={onOpen}>
      {showBasicRoleOnLabel && <ValueContainer>{basicRole}</ValueContainer>}
      <RolesLabel
        appliedRoles={appliedRoles}
        numberOfRoles={appliedRoles.length}
        showBuiltInRole={showBasicRoleOnLabel}
      />
      {isLoading && (
        <div className={styles.spinner}>
          <Spinner size={16} inline />
        </div>
      )}
    </div>
  ) : (
    <div className={styles.wrapper}>
      {showBasicRoleOnLabel && <ValueContainer>{basicRole}</ValueContainer>}
      {appliedRoles.map((role) => (
        <ValueContainer key={role.uid}>{role.group + ':' + (role.displayName || role.name)}</ValueContainer>
      ))}

      {!disabled && (
        <input
          {...rest}
          className={styles.input}
          ref={inputRef}
          onMouseDown={stopPropagation}
          onChange={onInputChange}
          data-testid="role-picker-input"
          placeholder={isFocused ? t('role-picker.input.placeholder-select-role', 'Select role') : undefined}
          value={query}
        />
      )}
      <div className={styles.suffix}>
        <Icon name="angle-up" className={styles.dropdownIndicator} onMouseDown={onClose} />
      </div>
    </div>
  );
};

RolePickerInput.displayName = 'RolePickerInput';

interface RolesLabelProps {
  appliedRoles: Role[];
  showBuiltInRole?: boolean;
  numberOfRoles: number;
}

export const RolesLabel = ({ showBuiltInRole, numberOfRoles, appliedRoles }: RolesLabelProps): JSX.Element => {
  const styles = useStyles2((theme) => getTooltipStyles(theme));

  return (
    <>
      {!!numberOfRoles ? (
        <Tooltip
          content={
            <div className={styles.tooltip}>
              {appliedRoles?.map((role) => <p key={role.uid}>{role.group + ':' + (role.displayName || role.name)}</p>)}
            </div>
          }
        >
          <ValueContainer>{`${showBuiltInRole ? '+' : ''}${numberOfRoles} role${
            numberOfRoles > 1 ? 's' : ''
          }`}</ValueContainer>
        </Tooltip>
      ) : (
        !showBuiltInRole && (
          <ValueContainer>
            <Trans i18nKey="role-picker.input.no-roles">No roles assigned</Trans>
          </ValueContainer>
        )
      )}
    </>
  );
};

const getRolePickerInputStyles = (
  theme: GrafanaTheme2,
  invalid: boolean,
  focused: boolean,
  disabled: boolean,
  withPrefix: boolean,
  width?: string
) => {
  const styles = getInputStyles({ theme, invalid });

  return {
    wrapper: cx(
      styles.wrapper,
      sharedInputStyle(theme, invalid),
      focused && css(getFocusStyles(theme)),
      disabled && styles.inputDisabled,
      css({
        minWidth: width || ROLE_PICKER_WIDTH + 'px',
        width: width,
        minHeight: '32px',
        maxHeight: '200px',
        overflow: 'scroll',
        overflowX: 'hidden',
        overflowY: 'auto',
        height: 'auto',
        flexDirection: 'row',
        paddingRight: theme.spacing(1),
        maxWidth: '100%',
        alignItems: 'center',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        position: 'relative',
        boxSizing: 'border-box',
        cursor: 'default',
      }),
      withPrefix &&
        css({
          paddingLeft: 0,
        })
    ),
    input: cx(
      sharedInputStyle(theme, invalid),
      css({
        maxWidth: '120px',
        border: 'none',
        cursor: focused ? 'default' : 'pointer',
      })
    ),
    suffix: styles.suffix,
    dropdownIndicator: css({
      cursor: 'pointer',
    }),
    selectedRoles: css({
      display: 'flex',
      alignItems: 'center',
      cursor: disabled ? 'not-allowed' : 'pointer',
    }),
    tooltip: css({
      p: {
        marginBottom: theme.spacing(0.5),
      },
    }),
    spinner: css({
      display: 'flex',
      flexGrow: 1,
      justifyContent: 'flex-end',
    }),
  };
};

const getTooltipStyles = (theme: GrafanaTheme2) => ({
  tooltip: css({
    p: {
      marginBottom: theme.spacing(0.5),
    },
  }),
});
