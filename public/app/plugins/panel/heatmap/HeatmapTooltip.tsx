import { css } from '@emotion/css';
import React from 'react';
import uPlot from 'uplot';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

interface Props {
  dataIdxs: Array<number | null>;
  seriesIdx: number | null | undefined;
  uPlot: uPlot;
  isPinned: boolean;
}
export const HeatmapTooltip = ({ dataIdxs, seriesIdx, uPlot, isPinned }: Props) => {
  const style = useStyles2(getStyles);

  return <div>TEST: HeatmapTooltip render</div>;
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    margin-top: 20px;
    background: ${theme.colors.background.primary};
  `,
});
