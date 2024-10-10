import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ v1: { spacing, colors, typography } }: GrafanaTheme2) => ({
  updateVersionModal: css`
    display: flex;
    flex-direction: column;
    width: 480px;
  `,
  version: css`
    margin-bottom: ${spacing.md};
  `,
  releaseNotesText: css`
    a {
      color: ${colors.textBlue};
    }
  `,
  newVersionsTitle: css`
    font-weight: ${typography.weight.semibold};
    font-size: ${typography.heading.h5};
    margin-bottom: 8px;
  `,
  howToUpdate: css`
    font-weight: ${typography.weight.semibold};
    font-size: ${typography.heading.h5};
    margin-top: 27px;
  `,
  updateButtons: css`
    margin-top: 35px;
    display: flex;
    justify-content: flex-end;
  `,
  snoozeButton: css`
    margin-right: 20px;
  `,
  listOfReleaseNotes: css`
    margin-left: 20px;
    li a, li {
      color: ${colors.textBlue};
    },
  `,
});
