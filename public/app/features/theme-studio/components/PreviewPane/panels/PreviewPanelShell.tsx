import { type ReactNode } from 'react';

import { type PreviewThemeTokens } from './previewTheme';

interface PreviewPanelShellProps {
  tokens: PreviewThemeTokens;
  title: string;
  subtitle?: string;
  toolbar?: ReactNode;
  children: ReactNode;
}

export const PreviewPanelShell = ({ tokens, title, subtitle, toolbar, children }: PreviewPanelShellProps) => {
  return (
    <div
      style={{
        background: tokens.panelBackground,
        borderRadius: 8,
        border: `1px solid ${tokens.panelBorder}`,
        boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 140,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${tokens.panelPadding}px ${tokens.panelPadding + 2}px 0 ${tokens.panelPadding + 2}px`,
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 13 * tokens.headingScale, fontWeight: 600, color: tokens.panelText }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: 12 * tokens.textScale, color: tokens.panelTextSecondary }}>{subtitle}</div>
          )}
        </div>
        {toolbar && <div style={{ fontSize: 12 }}>{toolbar}</div>}
      </div>
      <div
        style={{
          padding: `${tokens.panelPadding}px ${tokens.panelPadding + 2}px ${tokens.panelPadding + 2}px`,
          flex: 1,
        }}
      >
        {children}
      </div>
    </div>
  );
};
