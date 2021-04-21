import { css } from '@emotion/css';
import { GrafanaThemeV2 } from '@grafana/data';
import { stylesFactory } from '../../themes';

export const getModalStyles = stylesFactory((theme: GrafanaThemeV2) => {
  // rgba(1,4,9,0.8)
  const backdropBackground = 'rgba(0, 0, 0, 0.5)';
  const borderRadius = theme.shape.borderRadius(2);

  return {
    modal: css`
      position: fixed;
      z-index: ${theme.zIndex.modal};
      background: ${theme.colors.background.primary};
      box-shadow: ${theme.shadows.z4};
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
      background-color: ${backdropBackground};
    `,
    modalHeader: css`
      label: modalHeader;
      background: ${theme.colors.background.secondary};
      border-bottom: 1px solid ${theme.colors.border.weak};
      border-radius: ${borderRadius} ${borderRadius} 0 0;
      display: flex;
      height: 42px;
    `,
    modalHeaderTitle: css`
      font-size: ${theme.typography.size.lg};
      margin: 0 ${theme.spacing(2)};
      display: flex;
      align-items: center;
      line-height: 42px;
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
      flex-grow: 1;
      justify-content: flex-end;
      padding-right: ${theme.spacing(1)};
    `,
    modalContent: css`
      padding: calc(${theme.spacing.gridSize} * 2);
      overflow: auto;
      width: 100%;
      max-height: calc(90vh - ${theme.spacing.gridSize} * 2);
    `,
  };
});
