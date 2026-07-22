import { t } from '@grafana/i18n';

import { PreviewPanelShell } from './PreviewPanelShell';
import { type PreviewThemeTokens } from './previewTheme';

interface PanelProps {
  tokens: PreviewThemeTokens;
}

export const NoDataPreview = ({ tokens }: PanelProps) => {
  return (
    <PreviewPanelShell tokens={tokens} title={t('theme-studio.preview.no-data-state', 'No data state')}>
      <div
        style={{
          border: `1px dashed ${tokens.panelBorder}`,
          borderRadius: 6,
          padding: '20px',
          textAlign: 'center',
          color: tokens.panelTextSecondary,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: tokens.panelText }}>
          {t('theme-studio.preview.no-data', 'No data')}
        </div>
        <div style={{ fontSize: 12 * tokens.textScale }}>{t('theme-studio.preview.no-data-yet', 'No data yet')}</div>
      </div>
    </PreviewPanelShell>
  );
};
