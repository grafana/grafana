import { GrafanaTheme } from '@grafana/data';
import { css } from '@emotion/css';

export function getPlaylistStyles(theme: GrafanaTheme) {
  return {
    description: css`
      label: description;
      width: 555px;
      margin-bottom: 20px;
    `,
    subHeading: css`
      label: sub-heading;
      margin-bottom: ${theme.spacing.md};
    `,
  };
}
