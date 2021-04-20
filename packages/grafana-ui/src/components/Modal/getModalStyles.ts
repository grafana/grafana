import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { stylesFactory } from '../../themes';

export const getModalStyles = stylesFactory((theme: GrafanaTheme) => {
  // rgba(1,4,9,0.8)
  const backdropBackground = 'rgba(0, 0, 0, 0.5)';
  const borderRadius = theme.v2.shape.borderRadius(2);

  return {
    modal: css`
      position: fixed;
      z-index: ${theme.v2.zIndex.modal};
      background: ${theme.v2.palette.background.primary};
      box-shadow: ${theme.v2.shadows.z4};
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
      z-index: ${theme.v2.zIndex.modalBackdrop};
      background-color: ${backdropBackground};
    `,
    modalHeader: css`
      label: modalHeader;
      background: ${theme.colors.bg2};
      border-bottom: 1px solid ${theme.colors.pageHeaderBorder};
      border-radius: ${borderRadius} ${borderRadius} 0 0;
      display: flex;
      height: 42px;
    `,
    modalHeaderTitle: css`
      font-size: ${theme.typography.size.lg};
      margin: 0 ${theme.spacing.md};
      display: flex;
      align-items: center;
      line-height: 42px;
    `,
    modalHeaderIcon: css`
      margin-right: ${theme.spacing.md};
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
      padding-right: ${theme.spacing.sm};
    `,
    modalContent: css`
      padding: calc(${theme.spacing.d} * 2);
      overflow: auto;
      width: 100%;
      max-height: calc(90vh - ${theme.spacing.d} * 2);
    `,
  };
});
