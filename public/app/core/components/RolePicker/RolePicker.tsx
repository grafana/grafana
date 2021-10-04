import React, { FC } from 'react';
import { css, cx } from '@emotion/css';
import { CustomScrollbar, useStyles2, useTheme2 } from '@grafana/ui';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { SelectBase } from '@grafana/ui/src/components/Select/SelectBase';
import { getSelectStyles } from '@grafana/ui/src/components/Select/getSelectStyles';
import { getBackendSrv } from '@grafana/runtime';
import { Role } from 'app/types';
// import { getFocusStyles, getMouseFocusStyles } from '@grafana/ui/src/themes/mixins';

export interface Props {
  /** Primary role selected */
  role: string;
  /** Callback for returning the selected date */
  onChange: () => void;
}

export const RolePicker: FC<Props> = ({ role, onChange }) => {
  return (
    <SelectBase
      components={{ MenuList: RolePickerMenu }}
      onChange={onChange}
      value={{ label: role, value: role }}
      defaultOptions
      loadOptions={getRolesOptions}
      closeMenuOnSelect={false}
    />
  );
};

const getRolesOptions = async (query: string) => {
  const roles = await getBackendSrv().get('/api/access-control/roles');
  if (!roles || !roles.length) {
    return [];
  }
  return roles.map(
    (role: Role): SelectableValue => ({
      value: role.uid,
      label: role.name,
      description: role.description,
    })
  );
};

interface RolePickerMenuProps {
  maxHeight: number;
  innerRef: React.Ref<any>;
  innerProps: {};
}

export const RolePickerMenu: FC<RolePickerMenuProps> = (props) => {
  const theme = useTheme2();
  const styles = getSelectStyles(theme);
  const customStyles = useStyles2(getStyles);
  const { children, maxHeight, innerRef, innerProps } = props;

  return (
    <div
      {...innerProps}
      className={styles.menu}
      ref={innerRef}
      style={{ maxHeight: maxHeight * 2 }}
      aria-label="Role picker menu"
    >
      <div className={customStyles.groupHeader}>Built-in roles</div>
      <div className={styles.optionBody}>
        <div className={customStyles.inlineContainer}>
          <div className={customStyles.radioButton}>
            <input
              className={customStyles.radio}
              type="radio"
              name="built-in_role_selector"
              id="Viewer"
              value="Viewer"
              checked={true}
            />
            <label htmlFor="Viewer" />
          </div>
          <label className={cx(customStyles.inlineLabel, 'inline-radio-label')} htmlFor="Viewer">
            Viewer
          </label>
        </div>
        <div className={customStyles.inlineContainer}>
          <div className={customStyles.radioButton}>
            <input
              className={customStyles.radio}
              type="radio"
              name="built-in_role_selector"
              id="Editor"
              value="Editor"
              checked={false}
            />
            <label htmlFor="Editor" />
          </div>
          <label className={cx(customStyles.inlineLabel, 'inline-radio-label')} htmlFor="Editor">
            Editor
          </label>
        </div>
        <div className={customStyles.inlineContainer}>
          <div className={customStyles.radioButton}>
            <input
              className={customStyles.radio}
              type="radio"
              name="built-in_role_selector"
              id="Admin"
              value="Admin"
              checked={false}
            />
            <label htmlFor="Admin" />
          </div>
          <label className={cx(customStyles.inlineLabel, 'inline-radio-label')} htmlFor="Admin">
            Admin
          </label>
        </div>
        {/* <div className={styles.option}>Viewer</div>
        <div className={styles.option}>Editor</div>
        <div className={styles.option}>Admin</div> */}
      </div>
      <div className={customStyles.groupHeader}>Custom roles</div>
      <CustomScrollbar autoHide={false} autoHeightMax="inherit" hideHorizontalTrack>
        <div className={styles.optionBody}>{children}</div>
      </CustomScrollbar>
    </div>
  );
};

export const getStyles = (theme: GrafanaTheme2, isReversed = false) => {
  return {
    container: css``,
    groupHeader: css`
      padding: 8px;
      display: flex;
      align-items: center;
      color: ${theme.colors.primary.text};
    `,
    radioButton: css`
      width: 32px;
      height: 16px;
      position: relative;

      padding: 8px;

      input {
        opacity: 0;
        left: -100vw;
        z-index: -1000;
        position: absolute;

        &:disabled + label {
          background: ${theme.colors.action.disabledBackground};
          cursor: not-allowed;
        }

        &:checked + label {
          background: ${theme.colors.primary.main};
          border-color: ${theme.colors.primary.main};

          &::after {
            background: ${theme.colors.text.primary};
          }
        }
      }

      label {
        // width: 100%;
        // height: 100%;
        // cursor: pointer;
        // border: none;
        // border-radius: 50px;
        // background: ${theme.components.input.background};
        // transition: all 0.3s ease;
        border: 1px solid ${theme.components.input.borderColor};

        position: absolute;
        display: block;
        content: '';
        width: 12px;
        height: 12px;
        border-radius: 6px;
        // background: ${theme.colors.text.secondary};
        background: transparent;
        box-shadow: ${theme.shadows.z1};
        top: 50%;
        transform: translate3d(2px, -50%, 0);

        &:hover {
          border-color: ${theme.components.input.borderHover};
        }

        &::after {
          // display: none;
          position: absolute;
          display: block;
          content: '';
          width: 6px;
          height: 6px;
          border-radius: 3px;
          // background: ${theme.colors.text.primary};
          background: transparent;
          box-shadow: ${theme.shadows.z1};
          top: 50%;
          transform: translate3d(2px, -50%, 0);
          transition: transform 0.2s cubic-bezier(0.19, 1, 0.22, 1);
        }
      }
    `,
    inlineContainer: css`
      padding: ${theme.spacing(0, 1)};
      height: ${theme.spacing(theme.components.height.md)};
      display: inline-flex;
      align-items: center;
      background: ${theme.components.input.background};

      &:hover {
        .inline-radio-label {
          color: ${theme.colors.text.primary};
        }
      }
    `,
    inlineLabel: css`
      cursor: pointer;
      padding-right: ${theme.spacing(1)};
      color: ${theme.colors.text.secondary};
      white-space: nowrap;
    `,
    radio: css`
      margin-right: 8px;
    `,
    radioButtonLabel: css`
      padding: 8px;
    `,
  };
};
