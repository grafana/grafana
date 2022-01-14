import { stylesFactory } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

export const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  formWrapper: css`
    background-color: transparent !important;
    max-width: 1000px;
    width: 1000px;
  `,
  navigationPanel: css`
    display: flex;
    flex-direction: row;
    justify-content: start;
    flex-wrap: wrap;
    max-width: 800px;
    width: 100%;
    overflow: hidden;
  `,
  content: css`
    display: flex;
    flex-direction: column;
    align-items: center;
  `,
  addInstance: css`
    margin-top: ${theme.spacing.sm};
  `,
  addInstanceTitle: css`
    margin-top: ${theme.spacing.sm};
    width: 65%;
    height: 1.5em;
    white-space: nowrap;
  `,
  addRemoteInstanceTitle: css`
    text-align: center;
  `,
  addRemoteInstanceButtons: css`
    margin-top: ${theme.spacing.md};
    margin-bottom: ${theme.spacing.md};
  `,
  returnButton: css`
    margin-left: ${theme.spacing.md};
  `,
}));
