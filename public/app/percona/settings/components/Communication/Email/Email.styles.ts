import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ v1: { spacing } }: GrafanaTheme2) => ({
  emailForm: css`
    margin-top: ${spacing.md};
  `,
  authRadioGroup: css`
    & input[type='radio'] + label {
      white-space: nowrap;
    }
  `,
});
