import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ v1: { spacing } }: GrafanaTheme2) => ({
  version: css`
    margin-bottom: ${spacing.md};
  `,
  releaseNotesText: css``,
  howToUpdateTitle: css``,
  howToUpdateDescription: css``,
  newVersionsTitle: css``,
});
