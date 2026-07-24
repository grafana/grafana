import { type GrafanaTheme2 } from '@grafana/data';
import { ThemeContext } from '@grafana/ui';

import { PreviewDashboard } from './PreviewDashboard';
import { PreviewShowcase } from './PreviewShowcase';

interface PreviewPaneProps {
  theme: GrafanaTheme2;
}

export const PreviewPane = ({ theme }: PreviewPaneProps) => {
  return (
    <ThemeContext.Provider value={theme}>
      <section
        style={{
          height: '100%',
          minHeight: 0,
          overflowY: 'auto',
          background: theme.colors.background.canvas,
          color: theme.colors.text.primary,
          padding: 24,
          boxSizing: 'border-box',
        }}
      >
        <PreviewDashboard theme={theme} />
        <PreviewShowcase />
      </section>
    </ThemeContext.Provider>
  );
};
