import { useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';

import { NoDataPreview } from './panels/NoDataPreview';
import { TimeSeriesPreview } from './panels/TimeSeriesPreview';
import { getPreviewTheme, type PreviewThemeTokens } from './panels/previewTheme';

interface PreviewDashboardProps {
  theme: GrafanaTheme2;
}

export const PreviewDashboard = ({ theme }: PreviewDashboardProps) => {
  const tokens = useMemo<PreviewThemeTokens>(() => getPreviewTheme(theme), [theme]);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
        gap: 16,
        color: tokens.panelText,
      }}
    >
      <TimeSeriesPreview tokens={tokens} chartHeight={260} />
      <NoDataPreview tokens={tokens} />
    </div>
  );
};
