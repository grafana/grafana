import { css } from '@emotion/css';
import { GrafanaThemeV2 } from '@grafana/data';
import { stylesFactory } from '../../themes';

export const getModalStyles = stylesFactory((theme: GrafanaThemeV2) => {
  const borderRadius = theme.shape.borderRadius(2);

  return {
    modal: css`
      position: fixed;
      z-index: ${theme.zIndex.modal};
      background: ${theme.colors.background.primary};
      box-shadow: ${theme.shadows.z3};
      padding: ${theme.spacing(2)};
      border-radius: ${borderRadius};
      background-clip: padding-box;
      outline: none;
      width: 750px;
      max-width: 100%;
      left: 0;
      right: 0;
      margin-left: auto;
      margin-right: auto;
      top: 10%;
    `,
    modalBackdrop: css`
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      left: 0;
      z-index: ${theme.zIndex.modalBackdrop};
      background-color: ${theme.components.overlay.background};
      backdrop-filter: blur(1px);
    `,
    modalHeader: css`
      label: modalHeader;
      border-bottom: 1px solid ${theme.colors.border.weak};
      display: flex;
      align-items: center;
      min-height: 42px;
    `,
    modalHeaderTitle: css`
      font-size: ${theme.typography.size.lg};
      margin: ${theme.spacing(0, 4, 0, 2)};
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
      padding-right: ${theme.spacing(1)};
    `,
    modalContent: css`
      padding: ${theme.spacing(4, 2, 2, 2)};
      overflow: auto;
      width: 100%;
      max-height: calc(90vh - ${theme.spacing(2)});
    `,
    modalButtonRow: css`
      padding-top: ${theme.spacing(4)};
    `,
  };
});
