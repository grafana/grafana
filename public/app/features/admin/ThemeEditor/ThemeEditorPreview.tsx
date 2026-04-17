import { css } from '@emotion/css';

import { type GrafanaTheme2, ThemeContext } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Box, Icon, Stack, useStyles2 } from '@grafana/ui';

import { Branding } from '../../../core/components/Branding/Branding';

interface Props {
  theme: GrafanaTheme2;
}

export function ThemeEditorPreview({ theme }: Props) {
  return (
    <ThemeContext.Provider value={theme}>
      <PreviewContent />
    </ThemeContext.Provider>
  );
}

function PreviewContent() {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.root}>
      {/* Top bar */}
      <div className={styles.topBar}>
        <Stack alignItems="center" gap={1}>
          <Branding.MenuLogo className={styles.logo} />
          <span className={styles.breadcrumb}>{t('theme-editor.preview.breadcrumb', 'Home / Dashboards')}</span>
        </Stack>
        <Stack alignItems="center" gap={1}>
          <div className={styles.searchBar} />
          <div className={styles.avatar} />
        </Stack>
      </div>

      {/* Dashboard body */}
      <div className={styles.dashboard}>
        {/* Stat panels row */}
        <div className={styles.panelRow}>
          <StatPanel label={t('theme-editor.preview.requests', 'Requests/s')} value="12.4k" trend="+8.2%" positive />
          <StatPanel label={t('theme-editor.preview.error-rate', 'Error rate')} value="0.03%" trend="-2.1%" positive />
          <StatPanel
            label={t('theme-editor.preview.latency', 'Latency p99')}
            value="142ms"
            trend="+12ms"
            positive={false}
          />
          <StatPanel label={t('theme-editor.preview.uptime', 'Uptime')} value="99.98%" trend="0.0%" positive />
        </div>

        {/* Time series panel */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span>{t('theme-editor.preview.request-rate', 'Request rate')}</span>
            <Icon name="ellipsis-v" size="sm" className={styles.panelAction} />
          </div>
          <div className={styles.panelBody}>
            <TimeSeriesChart />
          </div>
        </div>

        {/* Two-column row */}
        <div className={styles.twoCol}>
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <span>{t('theme-editor.preview.status', 'Status')}</span>
            </div>
            <div className={styles.panelBody}>
              <ColorSwatches />
            </div>
          </div>
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <span>{t('theme-editor.preview.actions', 'Actions')}</span>
            </div>
            <div className={styles.panelBody}>
              <ButtonSamples />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatPanel({
  label,
  value,
  trend,
  positive,
}: {
  label: string;
  value: string;
  trend: string;
  positive: boolean;
}) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.panel}>
      <div className={styles.statContent}>
        <span className={styles.statLabel}>{label}</span>
        <span className={styles.statValue}>{value}</span>
        <span className={positive ? styles.trendPositive : styles.trendNegative}>{trend}</span>
      </div>
    </div>
  );
}

function TimeSeriesChart() {
  const styles = useStyles2(getStyles);

  return (
    <svg viewBox="0 0 600 160" className={styles.chart}>
      {/* Grid lines */}
      {[0, 40, 80, 120, 160].map((y) => (
        <line key={y} x1="0" y1={y} x2="600" y2={y} className={styles.gridLine} />
      ))}

      {/* Series 1 - primary */}
      <path
        d="M0,120 C50,100 100,80 150,90 C200,100 250,60 300,50 C350,40 400,70 450,45 C500,20 550,30 600,25"
        className={styles.seriesPrimary}
        fill="none"
        strokeWidth="2"
      />
      {/* Series 1 fill */}
      <path
        d="M0,120 C50,100 100,80 150,90 C200,100 250,60 300,50 C350,40 400,70 450,45 C500,20 550,30 600,25 L600,160 L0,160 Z"
        className={styles.seriesPrimaryFill}
      />

      {/* Series 2 - success */}
      <path
        d="M0,140 C50,130 100,125 150,135 C200,145 250,110 300,100 C350,90 400,105 450,95 C500,80 550,85 600,75"
        className={styles.seriesSuccess}
        fill="none"
        strokeWidth="2"
      />
    </svg>
  );
}

function ColorSwatches() {
  const styles = useStyles2(getSwatchStyles);

  return (
    <div className={styles.grid}>
      <Box display="flex" direction="column" gap={0.5}>
        <div className={styles.swatchPrimary} />
        <span className={styles.label}>{t('theme-editor.preview.primary', 'Primary')}</span>
      </Box>
      <Box display="flex" direction="column" gap={0.5}>
        <div className={styles.swatchSuccess} />
        <span className={styles.label}>{t('theme-editor.preview.success', 'Success')}</span>
      </Box>
      <Box display="flex" direction="column" gap={0.5}>
        <div className={styles.swatchWarning} />
        <span className={styles.label}>{t('theme-editor.preview.warning', 'Warning')}</span>
      </Box>
      <Box display="flex" direction="column" gap={0.5}>
        <div className={styles.swatchError} />
        <span className={styles.label}>{t('theme-editor.preview.error', 'Error')}</span>
      </Box>
      <Box display="flex" direction="column" gap={0.5}>
        <div className={styles.swatchInfo} />
        <span className={styles.label}>{t('theme-editor.preview.info', 'Info')}</span>
      </Box>
    </div>
  );
}

function ButtonSamples() {
  const styles = useStyles2(getButtonStyles);

  return (
    <Stack gap={1} wrap="wrap">
      <div className={styles.btnPrimary}>{t('theme-editor.preview.btn-primary', 'Primary')}</div>
      <div className={styles.btnSecondary}>{t('theme-editor.preview.btn-secondary', 'Secondary')}</div>
      <div className={styles.btnDestructive}>{t('theme-editor.preview.btn-destructive', 'Destructive')}</div>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  root: css({
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: theme.colors.background.canvas,
    color: theme.colors.text.primary,
    overflow: 'auto',
  }),
  topBar: css({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing(1, 2),
    background: theme.colors.background.primary,
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  logo: css({
    height: 20,
    width: 20,
  }),
  breadcrumb: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  }),
  searchBar: css({
    width: 120,
    height: 28,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.medium}`,
    background: theme.components.input.background,
  }),
  avatar: css({
    width: 28,
    height: 28,
    borderRadius: theme.shape.radius.circle,
    background: theme.colors.secondary.main,
    border: `1px solid ${theme.colors.border.medium}`,
  }),
  dashboard: css({
    padding: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    flex: 1,
  }),
  panelRow: css({
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: theme.spacing(1.5),
  }),
  twoCol: css({
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing(1.5),
  }),
  panel: css({
    background: theme.components.panel.background,
    border: `1px solid ${theme.components.panel.borderColor}`,
    borderRadius: theme.shape.radius.default,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  }),
  panelHeader: css({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing(1, 1.5),
    fontSize: theme.typography.body.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  panelAction: css({
    color: theme.colors.text.secondary,
    cursor: 'pointer',
  }),
  panelBody: css({
    padding: theme.spacing(1.5),
    flex: 1,
  }),
  statContent: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: theme.spacing(1.5),
    gap: theme.spacing(0.25),
  }),
  statLabel: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
  }),
  statValue: css({
    fontSize: theme.typography.h3.fontSize,
    fontWeight: theme.typography.fontWeightBold,
    color: theme.colors.text.primary,
  }),
  trendPositive: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.success.text,
  }),
  trendNegative: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.error.text,
  }),
  chart: css({
    width: '100%',
    height: 160,
  }),
  gridLine: css({
    stroke: theme.colors.border.weak,
    strokeWidth: 0.5,
  }),
  seriesPrimary: css({
    stroke: theme.colors.primary.main,
  }),
  seriesPrimaryFill: css({
    fill: theme.colors.primary.transparent,
  }),
  seriesSuccess: css({
    stroke: theme.colors.success.main,
  }),
});

const getSwatchStyles = (theme: GrafanaTheme2) => ({
  grid: css({
    display: 'flex',
    gap: theme.spacing(2),
    flexWrap: 'wrap',
  }),
  label: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    textAlign: 'center' as const,
  }),
  swatchPrimary: css({
    width: 40,
    height: 40,
    borderRadius: theme.shape.radius.default,
    background: theme.colors.primary.main,
  }),
  swatchSuccess: css({
    width: 40,
    height: 40,
    borderRadius: theme.shape.radius.default,
    background: theme.colors.success.main,
  }),
  swatchWarning: css({
    width: 40,
    height: 40,
    borderRadius: theme.shape.radius.default,
    background: theme.colors.warning.main,
  }),
  swatchError: css({
    width: 40,
    height: 40,
    borderRadius: theme.shape.radius.default,
    background: theme.colors.error.main,
  }),
  swatchInfo: css({
    width: 40,
    height: 40,
    borderRadius: theme.shape.radius.default,
    background: theme.colors.info.main,
  }),
});

const getButtonStyles = (theme: GrafanaTheme2) => ({
  btnPrimary: css({
    padding: theme.spacing(0.5, 2),
    borderRadius: theme.shape.radius.default,
    background: theme.colors.primary.main,
    color: theme.colors.primary.contrastText,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    cursor: 'default',
  }),
  btnSecondary: css({
    padding: theme.spacing(0.5, 2),
    borderRadius: theme.shape.radius.default,
    background: theme.colors.secondary.main,
    color: theme.colors.secondary.contrastText,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    border: `1px solid ${theme.colors.border.medium}`,
    cursor: 'default',
  }),
  btnDestructive: css({
    padding: theme.spacing(0.5, 2),
    borderRadius: theme.shape.radius.default,
    background: theme.colors.error.main,
    color: theme.colors.error.contrastText,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    cursor: 'default',
  }),
});
