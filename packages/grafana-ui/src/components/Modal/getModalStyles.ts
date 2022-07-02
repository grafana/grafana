import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

import { stylesFactory } from '../../themes';

export const getModalStyles = stylesFactory((theme: GrafanaTheme2) => {
  const borderRadius = theme.shape.borderRadius(1);

  return {
    modal: css`
      position: fixed;
      z-index: ${theme.zIndex.modal};
      background: ${theme.colors.background.primary};
      box-shadow: ${theme.shadows.z3};
      border-radius: ${borderRadius};
      border: 1px solid ${theme.colors.border.weak};
      background-clip: padding-box;
      outline: none;
      width: 750px;
      max-width: 100%;
      left: 0;
      right: 0;
      margin-left: auto;
      margin-right: auto;
      top: 10%;
      max-height: 80%;
      display: flex;
      flex-direction: column;
    `,
    modalBackdrop: css`
      position: fixed;
      z-index: ${theme.zIndex.modalBackdrop};
      top: 0;
      right: 0;
      bottom: 0;
      left: 0;
      background-color: ${theme.components.overlay.background};
      backdrop-filter: blur(1px);
    `,
    modalHeader: css`
      label: modalHeader;
      display: flex;
      align-items: center;
      min-height: 42px;
      margin: ${theme.spacing(1, 2, 0, 2)};
    `,
    modalHeaderWithTabs: css`
      border-bottom: 1px solid ${theme.colors.border.weak};
    `,
    modalHeaderTitle: css`
      font-size: ${theme.typography.size.lg};
      margin: ${theme.spacing(0, 4, 0, 1)};
      display: flex;
      align-items: center;
      position: relative;
      top: 2px;
    `,
    modalHeaderIcon: css`
      margin-right: ${theme.spacing(2)};
      font-size: inherit;
      &:before {
        vertical-align: baseline;
      }
    `,
    modalHeaderClose: css`
      height: 100%;
      display: flex;
      align-items: center;
      color: ${theme.colors.text.secondary};
      flex-grow: 1;
      justify-content: flex-end;
    `,
    modalContent: css`
      overflow: auto;
      padding: ${theme.spacing(3)};
      width: 100%;
    `,
    modalButtonRow: css`
      padding-top: ${theme.spacing(3)};
    `,
  };
});
