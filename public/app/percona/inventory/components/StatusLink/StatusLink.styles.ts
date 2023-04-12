import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ visualization }: GrafanaTheme2, allAgentsOk: boolean) => ({
  link: css`
    text-decoration: underline;
    color: ${allAgentsOk ? visualization.getColorByName('green') : visualization.getColorByName('red')};
  `,
});
