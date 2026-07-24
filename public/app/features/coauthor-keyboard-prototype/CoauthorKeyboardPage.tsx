import { css, keyframes } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Button, Icon, IconButton, useStyles2 } from '@grafana/ui';

import { MockChart } from '../coauthor-prototype/components/MockChart';
import { OptionsPane } from '../coauthor-prototype/components/OptionsPane';

import { KeyboardQueryPane } from './components/KeyboardQueryPane';
import { AI_PURPLE } from './logic/flows';

/**
 * Second coauthor prototype: a keyboard-driven popover in the panel editor.
 * Chromeless, mock data only. Reachable at /coauthor-keyboard.
 */
export function CoauthorKeyboardPage() {
  const styles = useStyles2(getStyles);
  // Only the "highlight" flow starts from an existing, already-run panel query;
  // from-scratch and mid-query haven't run yet, so there's no data to show.
  const [flow, setFlow] = useState(1);
  const [assistant, setAssistant] = useState<{ title: string; body: string } | null>(null);
  const breadcrumb = [
    'Dashboards',
    'R&D',
    'Foundations',
    'Platform',
    'Platform Monitoring',
    'Test dashboard',
    'Edit panel',
  ];

  const handleFlow = (f: number) => {
    setFlow(f);
    setAssistant(null);
  };

  return (
    <div className={styles.root}>
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

      <div className={styles.main}>
        <div className={styles.left}>
          <div className={styles.viz}>{flow === 1 ? <MockChart /> : <div className={styles.noData}>No data</div>}</div>

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

              <KeyboardQueryPane onFlowChange={handleFlow} onOpenAssistant={setAssistant} />
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

        <OptionsPane />
      </div>

      {/* Mock Grafana Assistant side panel */}
      {assistant && (
        <div className={styles.assistant}>
          <div className={styles.assistantHeader}>
            <span className={styles.assistantTitle}>
              <Icon name="ai-sparkle" size="lg" style={{ color: AI_PURPLE }} /> Grafana Assistant
            </span>
            <IconButton name="times" aria-label="Close assistant" onClick={() => setAssistant(null)} tooltip="Close" />
          </div>
          <div className={styles.assistantBody}>
            <div className={styles.assistantMsg}>
              <div className={styles.assistantMsgLabel}>{assistant.title}</div>
              <p className={styles.assistantMsgText}>{assistant.body}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CoauthorKeyboardPage;

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
  viz: css({ flex: '0 0 38%', minHeight: 0, padding: theme.spacing(1, 2, 0) }),
  noData: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: theme.colors.text.disabled,
    fontSize: theme.typography.body.fontSize,
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

  assistant: css({
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    width: 400,
    maxWidth: '90vw',
    zIndex: 30,
    display: 'flex',
    flexDirection: 'column',
    background: theme.colors.background.primary,
    borderLeft: `1px solid ${theme.colors.border.weak}`,
    boxShadow: theme.shadows.z3,
    animation: `${slideIn} 0.2s ease`,
  }),
  assistantHeader: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(2),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  assistantTitle: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeightMedium,
    fontSize: theme.typography.h5.fontSize,
  }),
  assistantBody: css({ padding: theme.spacing(2), overflowY: 'auto' }),
  assistantMsg: css({
    background: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(2),
  }),
  assistantMsgLabel: css({
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing(1),
  }),
  assistantMsgText: css({
    margin: 0,
    color: theme.colors.text.primary,
    fontSize: theme.typography.body.fontSize,
    lineHeight: 1.6,
  }),
});

const slideIn = keyframes({
  from: { transform: 'translateX(100%)' },
  to: { transform: 'translateX(0)' },
});
