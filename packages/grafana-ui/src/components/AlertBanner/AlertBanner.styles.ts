import { type GrafanaTheme2 } from '@grafana/data';

import { type AlertVariant } from '../Alert/Alert';

/**
 * The colors of an AlertBanner, from the theme's alertBanner component tokens. The text defaults to each severity's
 * contrast text color, which suits the default background, the severity's main color. A theme that sets its own
 * background sets the text to match: the refresh themes use black in light mode and white in dark mode. The text
 * doesn't depend on the visual refresh flag, which Grafana sets on every theme, including ones with default tokens.
 * The border defaults to each severity's subtle border color. The refresh themes set it two palette steps lighter than
 * the background in dark mode, and one step darker in light mode.
 */
export const getAlertBannerColors = (theme: GrafanaTheme2, severity: AlertVariant) => {
  const { background, iconBoxBackground, text, border } = theme.components.alertBanner[severity];

  return { background, iconBox: iconBoxBackground, text, border };
};
