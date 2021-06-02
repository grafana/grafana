import { CSSProperties } from 'react';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  disabled: {
    opacity: 0.6,
    pointerEvents: 'none',
  } as CSSProperties,
  panelContentWrapper: css`
    div[data-qa='modal-body'] {
      left: 30%;
      max-width: 750px;
      top: 10%;
      transform: unset;
      width: 40%;
    }
  `,
});
