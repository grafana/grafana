import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ v1: { spacing: v1Spacing }, spacing }: GrafanaTheme2) => ({
  actionsWrapper: css`
    margin-top: 60px;
  `,
  form: css`
    width: 100%;
  `,
  toogleField: css`
    margin-top: ${v1Spacing.formInputMargin};
  `,
  filterRowWrapper: css`
    display: flex;
    gap: 10px;
    margin-bottom: ${v1Spacing.sm};
  `,
  filterFields: css`
    flex: 1;
  `,
  filterButton: css`
    margin-bottom: ${v1Spacing.md};
  `,
  selectField: css`
    padding-top: 7px;
    padding-bottom: 7px;
  `,
  iconWrapper: css`
    display: flex;
    justify-content: center;
    align-items: center;
  `,
  icon: css`
    cursor: pointer;
    margin-top: 10px;
  `,
  filtersLabelWrapper: css`
    display: flex;
    gap: ${v1Spacing.xs};
    margin-bottom: ${v1Spacing.xs};
    align-items: baseline;
  `,
  folderAndGroupSelect: css`
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    align-items: flex-end;
    align-items: baseline;
    margin-bottom: ${spacing(3)};
  `,
  folderAndGroupInput: css`
    width: 275px;

    & + & {
      margin-left: ${spacing(3)};
    }
  `,
});
