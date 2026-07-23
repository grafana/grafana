// Prototype-only: canned demo strings and a click-scrim backdrop; not i18n'd.
/* eslint-disable @grafana/i18n/no-untranslated-strings, jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */
import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../themes/ThemeContext';
import { IconButton } from '../../IconButton/IconButton';
import { Portal } from '../../Portal/Portal';

import { AssistantMark } from './AssistantMark';
import { QueryChips } from './QueryChips';
import { FLOW_STEPS, FLOW_STRIP } from './scriptedData';

interface Props {
  /** Screen coords to anchor the panel near (top-left of the editor). */
  anchor: { top: number; left: number };
  onClose: () => void;
}

/**
 * Journey 3 — the non-AI query-flow visualization. Explains a pasted query
 * step by step: a chip pipeline header, then a numbered data-flow breakdown
 * with series counts and tips. Rendered in a Portal so it isn't clipped by the
 * editor container.
 */
export function QueryFlowPanel({ anchor, onClose }: Props) {
  const styles = useStyles2(getStyles);
  return (
    <Portal>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.panel} style={{ top: anchor.top, left: anchor.left }}>
        <div className={styles.header}>
          <span className={styles.headerTitle}>Query flow</span>
          <span className={styles.badge}>{FLOW_STEPS.length} steps · 5 series out</span>
          <IconButton name="times-circle" size="sm" aria-label="Close query flow" onClick={onClose} />
        </div>

        <div className={styles.strip}>
          <QueryChips chips={FLOW_STRIP} />
        </div>

        <div className={styles.steps}>
          {FLOW_STEPS.map((step, i) => (
            <div key={i} className={styles.step}>
              <div className={styles.rail}>
                <span className={styles.stepNum}>{i + 1}</span>
                {i < FLOW_STEPS.length - 1 && <span className={styles.railLine} />}
              </div>
              <div className={styles.stepBody}>
                <div className={styles.stepTitleRow}>
                  <span className={styles.stepTitle} style={{ color: step.color }}>
                    {step.title}
                  </span>
                  <span className={styles.stepOut}>{step.out}</span>
                </div>
                <div className={styles.stepDesc}>{step.desc}</div>
                {step.note && (
                  <div className={styles.note} style={{ color: step.noteColor }}>
                    <span className={styles.noteDot} style={{ background: step.noteColor }} />
                    {step.note}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.footer}>
          <AssistantMark size={12} />
          <span>
            Want to change it? Press <kbd className={styles.kbd}>/</kbd> then <kbd className={styles.kbd}>space</kbd> to
            ask the assistant.
          </span>
        </div>
      </div>
    </Portal>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  backdrop: css({
    position: 'fixed',
    inset: 0,
    zIndex: theme.zIndex.portal - 1,
  }),
  panel: css({
    position: 'fixed',
    zIndex: theme.zIndex.portal,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    width: 460,
    maxHeight: '70vh',
    overflowY: 'auto',
    background: theme.colors.background.elevated ?? theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(2),
    boxShadow: theme.shadows.z3,
  }),
  header: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
  }),
  headerTitle: css({
    fontSize: theme.typography.body.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.text.primary,
  }),
  badge: css({
    fontSize: 11,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamilyMonospace,
    marginLeft: 'auto',
  }),
  strip: css({
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(1.25),
    overflowX: 'auto',
  }),
  steps: css({
    display: 'flex',
    flexDirection: 'column',
  }),
  step: css({
    display: 'flex',
    gap: theme.spacing(1.5),
  }),
  rail: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: 20,
    flex: 'none',
  }),
  stepNum: css({
    width: 18,
    height: 18,
    borderRadius: theme.shape.radius.circle,
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.medium}`,
    color: theme.colors.text.secondary,
    fontSize: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 'none',
  }),
  railLine: css({
    width: 1,
    flex: 1,
    background: theme.colors.border.weak,
  }),
  stepBody: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    paddingBottom: theme.spacing(1.75),
    minWidth: 0,
  }),
  stepTitleRow: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  }),
  stepTitle: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: 12,
  }),
  stepOut: css({
    fontSize: 10,
    color: theme.colors.text.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(0, 0.75),
    fontFamily: theme.typography.fontFamilyMonospace,
  }),
  stepDesc: css({
    fontSize: 12,
    color: theme.colors.text.secondary,
    lineHeight: 1.5,
  }),
  note: css({
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
    fontSize: 11.5,
    lineHeight: 1.5,
  }),
  noteDot: css({
    width: 6,
    height: 6,
    borderRadius: theme.shape.radius.circle,
    flex: 'none',
    marginTop: 5,
  }),
  footer: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    borderTop: `1px solid ${theme.colors.border.weak}`,
    paddingTop: theme.spacing(1.25),
    fontSize: 11.5,
    color: theme.colors.text.secondary,
    lineHeight: 1.5,
  }),
  kbd: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: 11,
    color: theme.colors.text.primary,
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(0, 0.5),
  }),
});
