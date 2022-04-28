import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';

export const getStyles = ({ v1: { spacing } }: GrafanaTheme2) => ({
  resolutionsWrapper: css`
    display: flex;
    flex-direction: column;
  `,
  resolutionsRadioButtonGroup: css`
    padding: ${spacing.lg} 0 ${spacing.xl} 0;
  `,
  resolutionInput: css`
    input {
      width: 60px;
    }
  `,
  numericFieldWrapper: css`
    width: 100px;
    white-space: nowrap;
  `,
});
