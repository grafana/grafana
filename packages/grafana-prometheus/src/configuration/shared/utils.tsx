import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { FieldValidationMessage } from '@grafana/ui';

/**
 * Use this to return a url in a tooltip in a field. Don't forget to make the field interactive to be able to click on the tooltip
 * @param url
 * @returns
 */
export function docsTip(url?: string) {
  const docsUrl = 'https://grafana.com/docs/grafana/latest/datasources/prometheus/configure-prometheus-data-source/';

  return (
    <a href={url ? url : docsUrl} target="_blank" rel="noopener noreferrer">
      Visit docs for more details here.
    </a>
  );
}

export const validateInput = (
  input: string,
  pattern: string | RegExp,
  errorMessage?: string
): boolean | JSX.Element => {
  const defaultErrorMessage = 'Value is not valid';
  if (input && !input.match(pattern)) {
    return <FieldValidationMessage>{errorMessage ? errorMessage : defaultErrorMessage}</FieldValidationMessage>;
  }
  return true;
};

export function overhaulStyles(theme: GrafanaTheme2) {
  return {
    additionalSettings: css({
      marginBottom: '25px',
    }),
    secondaryGrey: css({
      color: theme.colors.secondary.text,
      opacity: '65%',
    }),
    inlineError: css({
      margin: '0px 0px 4px 245px',
    }),
    switchField: css({
      alignItems: 'center',
    }),
    sectionHeaderPadding: css({
      paddingTop: '32px',
    }),
    sectionBottomPadding: css({
      paddingBottom: '28px',
    }),
    subsectionText: css({
      fontSize: '12px',
    }),
    hrBottomSpace: css({
      marginBottom: '56px',
    }),
    hrTopSpace: css({
      marginTop: '50px',
    }),
    textUnderline: css({
      textDecoration: 'underline',
    }),
    versionMargin: css({
      marginBottom: '12px',
    }),
    advancedHTTPSettingsMargin: css({
      margin: '24px 0 8px 0',
    }),
    advancedSettings: css({
      paddingTop: '32px',
    }),
    alertingTop: css({
      marginTop: '40px !important',
    }),
    overhaulPageHeading: css({
      fontWeight: 400,
    }),
    container: css({
      maxwidth: 578,
    }),
  };
}
