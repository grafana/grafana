import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ colors }: GrafanaTheme) => ({
  disabledButton: css`
    color: ${colors.formInputDisabledText};
    background-color: ${colors.dropdownBg};
    pointer-events: none;

    :hover {
      background-color: ${colors.dropdownBg} !important;
    }
  `,
});
