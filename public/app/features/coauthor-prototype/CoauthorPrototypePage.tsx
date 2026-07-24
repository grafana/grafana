import { css, cx } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Button, Icon, useStyles2 } from '@grafana/ui';

import { MockChart } from './components/MockChart';
import { OptionsPane } from './components/OptionsPane';
import { QueryEditorPane } from './components/QueryEditorPane';

/**
 * Standalone, chromeless prototype of "coauthor mode" inside the Grafana panel
 * editor. Everything is mocked — there is no real datasource or panel behind
 * it. Reachable at /coauthor-prototype.
 */
export function CoauthorPrototypePage() {
  const styles = useStyles2(getStyles);
  const [coauthorOn, setCoauthorOn] = useState(false);

  const breadcrumb = [
    'Dashboards',
    'R&D',
    'Foundations',
    'Platform',
    'Platform Monitoring',
    'Test dashboard',
    'Edit panel',
  ];

  return (
    <div className={styles.root}>
      {/* Top toolbar */}
      <div className={styles.topbar}>
        <div className={styles.breadcrumb}>
          <Icon name="apps" />
          {breadcrumb.map((b, i) => (
            <span key={b} className={i === breadcrumb.length - 1 ? styles.crumbActive : styles.crumb}>
              {i > 0 && <span className={styles.sep}>›</span>}
              {b}
            </span>
          ))}
        </div>
        <div className={styles.topActions}>
          <Button variant="secondary" fill="outline" size="sm" icon="arrow-left">
            Back to dashboard
          </Button>
          <Button variant="secondary" size="sm">
            Discard panel changes
          </Button>
          <Button size="sm">Save</Button>
        </div>
      </div>

      {/* Body: viz + data pane on the left, options pane on the right */}
      <div className={styles.main}>
        <div className={styles.left}>
          <div className={cx(styles.viz, coauthorOn && styles.vizCompact)}>
            <MockChart />
          </div>

          <div className={styles.dataPane}>
            <div className={styles.banner}>
              <span className={styles.bannerTitle}>
                <Icon name="flask" size="sm" /> New query editor
              </span>
              <span className={styles.bannerText}>Welcome to the improved query editing experience.</span>
              <span className={styles.bannerRight}>
                <span className={styles.bannerLink}>
                  <Icon name="comment-alt" size="sm" /> Give feedback
                </span>
                <span className={styles.bannerLink}>‹ Back to classic</span>
              </span>
            </div>

            <div className={styles.dataRow}>
              <div className={styles.rail}>
                <div className={styles.railTabs}>
                  <span className={styles.railTabActive}>
                    <Icon name="database" size="sm" /> Data
                  </span>
                  <span className={styles.railTab}>Alerts (0)</span>
                </div>
                <div className={styles.railSectionHeader}>
                  Queries &amp; Expressions <Icon name="plus-circle" size="sm" />
                </div>
                <div className={styles.railItem}>
                  <Icon name="calculator-alt" size="sm" /> A
                </div>
                <div className={styles.railSectionHeader}>
                  Transformations <Icon name="plus-circle" size="sm" />
                </div>
              </div>

              <QueryEditorPane coauthorOn={coauthorOn} setCoauthorOn={setCoauthorOn} />
            </div>

            <div className={styles.footer}>
              <span className={styles.footerItem}>Query options ▾</span>
              <span className={styles.footerMeta}>Max data points 500</span>
              <span className={styles.footerMeta}>Min interval 30s</span>
              <span className={styles.footerMeta}>Interval 30s</span>
              <span className={styles.footerMeta}>Relative time 1h</span>
              <span className={styles.footerMeta}>Time shift 1h</span>
              <span className={styles.footerRight}>
                <Icon name="compass" size="sm" /> Inspect queries
              </span>
            </div>
          </div>
        </div>

        {/* Hidden in coauthor mode to give the editor more room */}
        {!coauthorOn && <OptionsPane />}
      </div>
    </div>
  );
}

export default CoauthorPrototypePage;

const getStyles = (theme: GrafanaTheme2) => ({
  root: css({
    position: 'fixed',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    background: theme.colors.background.canvas,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily,
  }),
  topbar: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(1, 2),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    flexShrink: 0,
  }),
  breadcrumb: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  crumb: css({ display: 'inline-flex', alignItems: 'center', gap: theme.spacing(0.5) }),
  crumbActive: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    color: theme.colors.text.primary,
  }),
  sep: css({ color: theme.colors.text.disabled }),
  topActions: css({ display: 'flex', gap: theme.spacing(1) }),

  main: css({ flex: 1, display: 'flex', minHeight: 0 }),
  left: css({ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }),
  viz: css({
    flex: '0 0 42%',
    minHeight: 0,
    padding: theme.spacing(1, 2, 0),
    transition: 'flex-basis 0.15s ease',
  }),
  // In coauthor mode the chart shrinks so the editor gets more vertical room.
  vizCompact: css({
    flex: '0 0 26%',
  }),
  dataPane: css({
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    borderTop: `1px solid ${theme.colors.border.weak}`,
    overflow: 'hidden',
  }),
  banner: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 2),
    background: theme.colors.background.primary,
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  bannerTitle: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    color: theme.colors.warning.text,
    fontWeight: theme.typography.fontWeightMedium,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  bannerText: css({ color: theme.colors.text.secondary, fontSize: theme.typography.bodySmall.fontSize }),
  bannerRight: css({ marginLeft: 'auto', display: 'flex', gap: theme.spacing(2) }),
  bannerLink: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    color: theme.colors.text.link,
    fontSize: theme.typography.bodySmall.fontSize,
    cursor: 'pointer',
  }),

  dataRow: css({
    flex: 1,
    display: 'flex',
    minHeight: 0,
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5),
    overflow: 'auto',
  }),
  rail: css({ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: theme.spacing(1) }),
  railTabs: css({
    display: 'flex',
    gap: theme.spacing(1.5),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    paddingBottom: theme.spacing(1),
  }),
  railTab: css({ color: theme.colors.text.secondary, fontSize: theme.typography.bodySmall.fontSize }),
  railTabActive: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    color: theme.colors.text.primary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  railSectionHeader: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    marginTop: theme.spacing(1),
  }),
  railItem: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0.75, 1),
    border: `1px solid ${theme.colors.warning.border}`,
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.primary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),

  footer: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(1, 2),
    borderTop: `1px solid ${theme.colors.border.weak}`,
    background: theme.colors.background.primary,
    color: theme.colors.text.link,
    fontSize: theme.typography.bodySmall.fontSize,
    flexShrink: 0,
  }),
  footerItem: css({ color: theme.colors.text.link }),
  footerMeta: css({ color: theme.colors.text.secondary }),
  footerRight: css({ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }),
});
