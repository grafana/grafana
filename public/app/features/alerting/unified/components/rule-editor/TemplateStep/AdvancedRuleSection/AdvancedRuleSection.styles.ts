import { css } from '@emotion/css';

import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  templateParsedField: css`
    margin-bottom: ${spacing.formInputMargin};
  `,
});
