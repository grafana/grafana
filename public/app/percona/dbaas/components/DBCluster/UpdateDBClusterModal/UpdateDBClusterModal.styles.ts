import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ palette, spacing }: GrafanaTheme) => ({
  modalWrapper: css`
    div[data-testid='modal-body'] {
      left: 27%;
      width: 45%;
      max-width: none;
    }
  `,
  updateModalContent: css`
    margin-bottom: ${spacing.xl};
  `,
  highlight: css`
    color: ${palette.warn};
  `,
});
