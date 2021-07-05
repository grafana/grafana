import { css } from '@emotion/css';
import { DataFrame, DataFrameFieldIndex, GrafanaTheme } from '@grafana/data';
import { UPlotConfigBuilder, useStyles } from '@grafana/ui';
import React from 'react';

interface MarkerProps {
  dataFrame: DataFrame;
  dataFrameFieldIndex: DataFrameFieldIndex;
  config: UPlotConfigBuilder;
}

export const AudibleMarker: React.FC<MarkerProps> = ({ dataFrame, dataFrameFieldIndex, config }) => {
  const styles = useStyles(getStyles);

  const getSymbol = () => {
    const symbols = [
      <rect key="diamond" x="3.38672" width="4.78985" height="4.78985" transform="rotate(45 3.38672 0)" />,
      <path
        key="x"
        d="M1.94444 3.49988L0 5.44432L1.55552 6.99984L3.49996 5.05539L5.4444 6.99983L6.99992 5.44431L5.05548 3.49988L6.99983 1.55552L5.44431 0L3.49996 1.94436L1.5556 0L8.42584e-05 1.55552L1.94444 3.49988Z"
      />,
      <path key="triangle" d="M4 0L7.4641 6H0.535898L4 0Z" />,
      <rect key="rectangle" width="5" height="5" />,
      <path key="pentagon" d="M3 0.5L5.85317 2.57295L4.76336 5.92705H1.23664L0.146831 2.57295L3 0.5Z" />,
      <path
        key="plus"
        d="m2.35672,4.2425l0,2.357l1.88558,0l0,-2.357l2.3572,0l0,-1.88558l-2.3572,0l0,-2.35692l-1.88558,0l0,2.35692l-2.35672,0l0,1.88558l2.35672,0z"
      />,
    ];
    return symbols[dataFrameFieldIndex.frameIndex % symbols.length];
  };

  const seriesColor = config
    .getSeries()
    .find((s) => s.props.dataFrameFieldIndex?.frameIndex === dataFrameFieldIndex.frameIndex)?.props.lineColor;

  return (
    <svg viewBox="0 0 7 7" width="7" height="7" style={{ fill: seriesColor }} className={styles.marble}>
      {getSymbol()}
    </svg>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    marble: css`
      display: block;
      opacity: 0.5;
      transition: transform 0.15s ease-out;
    `,
  };
};
