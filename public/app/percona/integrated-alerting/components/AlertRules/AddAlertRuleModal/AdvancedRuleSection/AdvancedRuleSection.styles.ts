import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  templateParsedField: css`
    margin-bottom: ${spacing.formInputMargin};
  `,
});
