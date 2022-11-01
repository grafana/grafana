import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ v1: { spacing } }: GrafanaTheme2) => ({
  scheduleSectionWrapper: css`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: ${spacing.sm};
  `,
  SelectFieldWrap: css`
    display: flex;
    flex-direction: column;
    padding-top: ${spacing.xs};
    margin-bottom: 17px;
  `,
  selectField: css`
    padding-top: 7px;
    padding-bottom: 7px;
  `,
  displayNone: css`
    display: none;
  `,
  multiSelectField: css`
    padding-bottom: ${spacing.md};
  `,
  section: css`
    margin-top: 48px;
  `,
  retentionField: css`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: ${spacing.sm};
  `,
  headingStyle: css`
    margin-bottom: ${spacing.lg};
  `,
});
