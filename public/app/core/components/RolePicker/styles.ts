import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

import { ROLE_PICKER_SUBMENU_MIN_WIDTH } from './constants';

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    menuWrapper: css`
      display: flex;
      max-height: 650px;
      position: absolute;
      z-index: ${theme.zIndex.dropdown};
      overflow: hidden;
      min-width: auto;
    `,
    menu: css`
      min-width: ${ROLE_PICKER_SUBMENU_MIN_WIDTH}px;

      & > div {
        padding-top: ${theme.spacing(1)};
      }
    `,
    menuLeft: css`
      right: 0;
      flex-direction: row-reverse;
    `,
    subMenu: css`
      height: 100%;
      min-width: ${ROLE_PICKER_SUBMENU_MIN_WIDTH}px;
      display: flex;
      flex-direction: column;
      border-left: 1px solid ${theme.components.input.borderColor};

      & > div {
        padding-top: ${theme.spacing(1)};
      }
    `,
    subMenuLeft: css`
      border-right: 1px solid ${theme.components.input.borderColor};
      border-left: unset;
    `,
    groupHeader: css`
      padding: ${theme.spacing(0, 4.5)};
      display: flex;
      align-items: center;
      color: ${theme.colors.text.primary};
      font-weight: ${theme.typography.fontWeightBold};
    `,
    container: css`
      padding: ${theme.spacing(1)};
      border: 1px ${theme.colors.border.weak} solid;
      border-radius: ${theme.shape.borderRadius(1)};
      background-color: ${theme.colors.background.primary};
      z-index: ${theme.zIndex.modal};
    `,
    menuSection: css`
      margin-bottom: ${theme.spacing(2)};
    `,
    menuOptionCheckbox: css`
      display: flex;
      margin: ${theme.spacing(0, 1, 0, 0.25)};
    `,
    menuButtonRow: css`
      background-color: ${theme.colors.background.primary};
      padding: ${theme.spacing(1)};
    `,
    menuOptionBody: css`
      font-weight: ${theme.typography.fontWeightRegular};
      padding: ${theme.spacing(0, 1.5, 0, 0)};
    `,
    menuOptionDisabled: css`
      color: ${theme.colors.text.disabled};
      cursor: not-allowed;
    `,
    menuOptionExpand: css`
      position: absolute;
      right: ${theme.spacing(1.25)};
      color: ${theme.colors.text.disabled};

      &:after {
        content: '>';
      }
    `,
    menuOptionInfoSign: css`
      color: ${theme.colors.text.disabled};
    `,
    basicRoleSelector: css`
      margin: ${theme.spacing(1, 1.25, 1, 1)};
    `,
    subMenuPortal: css`
      height: 100%;
      > div {
        height: 100%;
      }
    `,
    subMenuButtonRow: css`
      background-color: ${theme.colors.background.primary};
      padding: ${theme.spacing(1)};
    `,
    checkboxPartiallyChecked: css`
      input {
        &:checked + span {
          &:after {
            border-width: 0 3px 0px 0;
            transform: rotate(90deg);
          }
        }
      }
    `,
  };
};
