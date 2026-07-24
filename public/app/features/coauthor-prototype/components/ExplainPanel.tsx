import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2, useTheme2 } from '@grafana/ui';

import { chipColor } from '../logic/chipColors';
import { type FlowNode, type Understanding } from '../logic/queryModel';

interface Props {
  understanding: Understanding;
  baseline: Understanding;
  showDiff: boolean;
  canDiff: boolean;
  onToggleDiff: (v: boolean) => void;
  /** When the user highlights a span, the explanation adapts to that section. */
  focus?: { label: string; explanation: string } | null;
}

/** The "Explaining Query A" container: WHY + a visual query-flow diagram. */
export function ExplainPanel({ understanding, baseline, showDiff, canDiff, onToggleDiff, focus }: Props) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();

  const baselineNodes = [...baseline.flow.branches.flat(), ...baseline.flow.merge];
  const currentNodes = [...understanding.flow.branches.flat(), ...understanding.flow.merge];
  const baselineTexts = new Set(baselineNodes.map((n) => n.text));
  const currentTexts = new Set(currentNodes.map((n) => n.text));
  const diffing = showDiff && canDiff;
  const removedNodes = diffing ? baselineNodes.filter((n) => !currentTexts.has(n.text)) : [];

  const renderNode = (node: FlowNode, key: string) => {
    const color = chipColor(theme, node.role);
    const isNew = diffing && !baselineTexts.has(node.text);
    return (
      <div key={key} className={styles.nodeWrap}>
        <div
          className={cx(styles.node, isNew && styles.nodeNew)}
          style={{
            color: color.text,
            background: color.bg,
            borderColor: isNew ? theme.colors.success.border : color.border,
          }}
          title={node.text}
        >
          {node.text}
        </div>
        {node.caption && <span className={styles.caption}>{node.caption}</span>}
      </div>
    );
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>
          <Icon name="ai-sparkle" size="sm" /> Explaining Query A
        </span>
        <span className={styles.hint}>tab to explain more</span>
      </div>

      <div className={styles.body}>
        {diffing && (
          <div className={styles.diffSummary}>
            <div className={styles.sectionLabel}>WHAT CHANGED</div>
            <p className={styles.diffOld}>{baseline.sentence}</p>
            <p className={styles.diffNew}>{understanding.sentence}</p>
          </div>
        )}

        {!diffing && focus && (
          <div className={styles.focus}>
            <div className={styles.sectionLabel}>{focus.label}</div>
            <p className={styles.focusText}>{focus.explanation}</p>
          </div>
        )}

        <div className={styles.sectionLabel}>WHY</div>
        <p className={styles.why}>{understanding.why}</p>

        <div className={styles.flowHeader}>
          <span className={styles.sectionLabel}>QUERY FLOW</span>
          {canDiff && (
            <div className={styles.diffToggle}>
              <button
                className={cx(styles.toggleBtn, !diffing && styles.toggleActive)}
                onClick={() => onToggleDiff(false)}
              >
                Current
              </button>
              <button
                className={cx(styles.toggleBtn, diffing && styles.toggleActive)}
                onClick={() => onToggleDiff(true)}
              >
                Diff
              </button>
            </div>
          )}
        </div>

        <div className={styles.branches}>
          {understanding.flow.branches.map((branch, bi) => (
            <div key={bi} className={styles.branch}>
              {branch.map((node, ni) => (
                <div key={ni} className={styles.stack}>
                  {renderNode(node, `${bi}-${ni}`)}
                  {ni < branch.length - 1 && <Icon name="arrow-down" size="sm" className={styles.arrow} />}
                </div>
              ))}
            </div>
          ))}
        </div>

        {understanding.flow.merge.length > 0 && (
          <>
            <div className={styles.mergeArrow}>
              <Icon name="arrow-down" size="sm" className={styles.arrow} />
            </div>
            <div className={styles.merge}>
              {understanding.flow.merge.map((node, i) => (
                <div key={i} className={styles.stack}>
                  {renderNode(node, `m-${i}`)}
                  {i < understanding.flow.merge.length - 1 && (
                    <Icon name="arrow-down" size="sm" className={styles.arrow} />
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {removedNodes.length > 0 && (
          <div className={styles.removedRow}>
            <span className={styles.sectionLabel}>REMOVED</span>
            <div className={styles.removedNodes}>
              {removedNodes.map((n, i) => (
                <span key={i} className={styles.removedNode}>
                  {n.text}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  panel: css({
    width: 300,
    flexShrink: 0,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.primary,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  }),
  header: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(1, 1.5),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  title: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    color: theme.colors.primary.text,
    fontWeight: theme.typography.fontWeightMedium,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  hint: css({ color: theme.colors.text.disabled, fontSize: theme.typography.bodySmall.fontSize }),
  body: css({ padding: theme.spacing(1.5), overflowY: 'auto' }),
  focus: css({
    padding: theme.spacing(1),
    marginBottom: theme.spacing(1.5),
    border: `1px solid ${theme.colors.primary.border}`,
    borderRadius: theme.shape.radius.default,
    background: 'rgba(110, 159, 255, 0.08)',
  }),
  focusText: css({
    color: theme.colors.text.primary,
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: 1.5,
    margin: 0,
  }),
  diffSummary: css({
    padding: theme.spacing(1),
    marginBottom: theme.spacing(1.5),
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.secondary,
  }),
  diffOld: css({
    color: theme.colors.text.disabled,
    fontSize: theme.typography.bodySmall.fontSize,
    textDecoration: 'line-through',
    margin: theme.spacing(0, 0, 0.5),
  }),
  diffNew: css({
    color: theme.colors.success.text,
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: 1.4,
    margin: 0,
  }),
  removedRow: css({ marginTop: theme.spacing(1.5) }),
  removedNodes: css({ display: 'flex', flexWrap: 'wrap', gap: theme.spacing(0.5) }),
  removedNode: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: 11,
    padding: theme.spacing(0.25, 0.75),
    borderRadius: theme.shape.radius.default,
    color: theme.colors.error.text,
    background: 'rgba(255, 82, 134, 0.12)',
    textDecoration: 'line-through',
  }),
  sectionLabel: css({
    fontSize: 10,
    letterSpacing: 0.6,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing(0.5),
  }),
  why: css({
    color: theme.colors.text.primary,
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: 1.5,
    margin: theme.spacing(0, 0, 2),
  }),
  flowHeader: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(1),
  }),
  diffToggle: css({
    display: 'inline-flex',
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    overflow: 'hidden',
  }),
  toggleBtn: css({
    all: 'unset',
    padding: theme.spacing(0, 0.75),
    fontSize: 11,
    color: theme.colors.text.secondary,
    cursor: 'pointer',
  }),
  toggleActive: css({ background: theme.colors.background.secondary, color: theme.colors.text.primary }),
  branches: css({ display: 'flex', gap: theme.spacing(2), justifyContent: 'center' }),
  branch: css({ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }),
  stack: css({ display: 'flex', flexDirection: 'column', alignItems: 'center' }),
  nodeWrap: css({ display: 'flex', flexDirection: 'column', alignItems: 'center' }),
  node: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: 11,
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.shape.radius.default,
    border: '1px solid transparent',
    maxWidth: 130,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  nodeNew: css({ boxShadow: `0 0 0 2px ${theme.colors.success.border}` }),
  caption: css({ fontSize: 10, color: theme.colors.text.disabled, marginTop: 2 }),
  arrow: css({ color: theme.colors.text.disabled, margin: theme.spacing(0.25, 0) }),
  mergeArrow: css({ display: 'flex', justifyContent: 'center' }),
  merge: css({ display: 'flex', flexDirection: 'column', alignItems: 'center' }),
});
