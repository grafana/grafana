import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';

const centeredButton = css`
  width: 100%;
  display: flex;
  justify-content: center;
`;

export const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  legend: css`
    color: ${(theme.colors as any).formLegend};
    font-size: ${theme.typography.heading.h3};
    font-weight: ${theme.typography.weight.regular};
    margin: ${(theme.spacing as any).formLegendMargin};
    text-align: center;
  `,
  link: css`
    font-size: 1em;
    height: 1em;
    padding: 0;
    vertical-align: baseline;
  `,
  checkboxWrapper: css`
    label {
      text-align: left;
    }

    &.invalid input + span {
      box-shadow: inset 0 0 5px ${(theme.colors as any).red};
    }
  `,
  checkboxLabel: css`
    display: inline-block;
    font-size: 12px;
    line-height: 1.7;
    padding-right: ${theme.spacing.formInputPaddingHorizontal};
  `,
  formWrapper: css`
    align-items: start;
    display: flex;
    flex-direction: column;
    margin-right: 30px;
  `,
  form: css`
    max-width: 300px;
    min-width: 150px;
    width: 100%;
  `,
  submitButton: css`
    ${centeredButton}
    margin-bottom: ${theme.spacing.formInputMargin};
  `,
  signInButton: css`
    ${centeredButton}
    margin-bottom: ${theme.spacing.formInputMargin};
  `,
  forgotPasswordButton: css`
    padding: 0;
    margin-bottom: ${theme.spacing.xl};
  `,
}));
