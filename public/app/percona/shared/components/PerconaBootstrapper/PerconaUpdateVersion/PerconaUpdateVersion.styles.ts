import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ v1: { spacing, colors } }: GrafanaTheme2) => ({
  updateVersionModal: css`
    display: flex;
    flex-direction: column;
    width: 480px;
    height: 343px;
  `,
  version: css`
    margin-bottom: ${spacing.md};
  `,
  releaseNotesText: css`
    a {
      color: ${colors.textBlue};
    }
  `,
  howToUpdateTitle: css``,
  howToUpdateDescription: css``,
  newVersionsTitle: css`
    font-weight: 500;
    font-size: 16px;
    margin-bottom: 8px;
  `,
  notesTitle: css`
    font-weight: 500;
    font-size: 16px;
    margin-top: 27px
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
