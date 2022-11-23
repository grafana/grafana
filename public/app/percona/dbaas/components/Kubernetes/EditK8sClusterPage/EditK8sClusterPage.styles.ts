import { css } from '@emotion/css';

import { GrafanaTheme } from '@grafana/data/src';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  checkbox: css`
    span {
      top: 0;
    }
  `,
  urlWarningWrapper: css`
    margin-bottom: ${spacing.md};
  `,
  pasteButton: css`
    background-color: red;
  `,
  pageToolbarWrapper: css`
    display: flex;
    align-items: flex-start;
    padding-right: ${spacing.lg};
  `,
  pmmUrlWarning: css`
    // TODO should be moved into PMMUrlServerWarning in https://jira.percona.com/browse/PMM-10873
    margin: ${spacing.md} ${spacing.md} ${spacing.md} ${spacing.lg};
  `,
  pageContent: css`
    padding: 0 ${spacing.lg};
  `,
  radioInfoIcon: css`
    margin-left: ${spacing.md};
  `,
  radioGroup: css`
    display: flex;
    align-items: center;
  `,
  k8sField: css`
    max-width: 500px;
    &:not(:last-child) {
      margin-bottom: 0px;
    }
  `,
  k8ConfigField: css`
    max-width: 800px;
    > div:first-child {
      label {
        display: flex;
        flex: 1 0 auto;
        align-items: flex-end;
        justify-content: space-between;
      }
    }
    &:not(:last-child) {
      margin-bottom: 0px;
    }
  `,
  awsField: css`
    max-width: 500px;
    &:not(:last-child) {
      margin-bottom: 6px;
    }
  `,
});
