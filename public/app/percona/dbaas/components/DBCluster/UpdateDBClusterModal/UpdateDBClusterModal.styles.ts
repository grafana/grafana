import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ palette, spacing }: GrafanaTheme) => ({
  modalWrapper: css`
    div[data-testid='modal-body'] {
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
