import { css } from '@emotion/css';

import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  line: css`
    display: flex;
    gap: ${spacing.md};
    > div {
      flex: 1 0 auto;
    }
  `,
  basicOptionsWrapper: css`
    max-width: 464px;
  `,
});
