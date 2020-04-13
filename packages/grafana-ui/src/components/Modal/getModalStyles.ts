import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { stylesFactory } from '../../themes';

export const getModalStyles = stylesFactory((theme: GrafanaTheme) => {
  const backdropBackground = theme.colors.bg1;

  return {
    modal: css`
      position: fixed;
      z-index: ${theme.zIndex.modal};
      background: ${theme.colors.bodyBg};
      box-shadow: 0 0 20px ${theme.colors.dropdownShadow};
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
      opacity: 0.7;
    `,
    modalHeader: css`
      background: ${theme.colors.bg1};
      border-bottom: 1px solid ${theme.colors.pageHeaderBorder};
      display: flex;
      height: 42px;
    `,
    modalHeaderTitle: css`
      font-size: ${theme.typography.heading.h3};
      padding-top: ${theme.spacing.sm};
      margin: 0 ${theme.spacing.md};
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
