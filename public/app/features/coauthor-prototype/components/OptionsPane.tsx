import { css } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Icon, Input, Switch, TextArea, useStyles2 } from '@grafana/ui';

interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  badge?: string;
  children?: React.ReactNode;
}

function Section({ title, defaultOpen, badge, children }: SectionProps) {
  const styles = useStyles2(getStyles);
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className={styles.section}>
      <button className={styles.sectionHeader} onClick={() => setOpen((o) => !o)}>
        <span className={open ? styles.titleOpen : styles.titleClosed}>{title}</span>
        <span className={styles.headerRight}>
          {badge && <span className={styles.badge}>{badge}</span>}
          <Icon name={open ? 'angle-up' : 'angle-down'} />
        </span>
      </button>
      {open && children && <div className={styles.sectionBody}>{children}</div>}
    </div>
  );
}

/** Mocked panel-options pane. Purely decorative — nothing here is wired up. */
export function OptionsPane() {
  const styles = useStyles2(getStyles);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [transparent, setTransparent] = useState(false);

  return (
    <div className={styles.pane}>
      <div className={styles.pluginHeader}>
        <Icon name="graph-bar" />
        <span>Time series</span>
        <span className={styles.change}>Change</span>
      </div>

      <Section title="Panel options" defaultOpen>
        <label className={styles.field}>
          <span className={styles.labelRow}>
            Title
            <span className={styles.autogen}>
              <Icon name="ai-sparkle" size="sm" /> Auto-generate
            </span>
          </span>
          <Input value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
        </label>

        <label className={styles.field}>
          <span className={styles.labelRow}>
            Description
            <span className={styles.autogen}>
              <Icon name="ai-sparkle" size="sm" /> Auto-generate
            </span>
          </span>
          <TextArea rows={2} value={desc} onChange={(e) => setDesc(e.currentTarget.value)} />
        </label>

        <div className={styles.switchField}>
          <span>Transparent background</span>
          <Switch value={transparent} onChange={() => setTransparent((v) => !v)} />
        </div>
      </Section>

      <Section title="Panel links" />
      <Section title="Repeat options" />

      <Section title="Panel styles" defaultOpen badge="New!">
        <div className={styles.stylesGrid}>
          {['#3a5f2f', '#4e7d3f', '#6b5a1f', '#7d6a2f'].map((bg, i) => (
            <div
              key={i}
              className={styles.styleTile}
              style={{ background: `linear-gradient(180deg, ${bg}, transparent)` }}
            />
          ))}
        </div>
      </Section>

      <Section title="Tooltip" defaultOpen>
        <div className={styles.segment}>
          {['Single', 'All', 'Hidden'].map((s, i) => (
            <span key={s} className={i === 0 ? styles.segActive : styles.segItem}>
              {s}
            </span>
          ))}
        </div>
      </Section>

      <Section title="Legend" defaultOpen>
        <div className={styles.switchField}>
          <span>Visibility</span>
          <Switch value />
        </div>
        <div className={styles.segment}>
          <span className={styles.segActive}>List</span>
          <span className={styles.segItem}>Table</span>
        </div>
      </Section>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  pane: css({
    width: 330,
    flexShrink: 0,
    borderLeft: `1px solid ${theme.colors.border.weak}`,
    background: theme.colors.background.primary,
    overflowY: 'auto',
  }),
  pluginHeader: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 2),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeightMedium,
  }),
  change: css({
    marginLeft: 'auto',
    color: theme.colors.text.link,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightRegular,
  }),
  section: css({
    borderTop: `1px solid ${theme.colors.border.weak}`,
  }),
  sectionHeader: css({
    all: 'unset',
    boxSizing: 'border-box',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(0.75, 2),
    cursor: 'pointer',
    '&:hover': { background: theme.colors.emphasize(theme.colors.background.primary, 0.03) },
  }),
  titleOpen: css({ color: theme.colors.text.primary, fontWeight: theme.typography.fontWeightMedium }),
  titleClosed: css({ color: theme.colors.text.secondary, fontWeight: theme.typography.fontWeightMedium }),
  headerRight: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    color: theme.colors.text.secondary,
  }),
  badge: css({
    color: theme.colors.primary.text,
    border: `1px solid ${theme.colors.primary.border}`,
    borderRadius: theme.shape.radius.default,
    fontSize: 10,
    padding: theme.spacing(0, 0.5),
  }),
  sectionBody: css({ padding: theme.spacing(0, 2, 1.5) }),
  field: css({ display: 'block', marginBottom: theme.spacing(1.5) }),
  labelRow: css({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(0.5),
    color: theme.colors.text.primary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  autogen: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    color: theme.colors.primary.text,
    cursor: 'pointer',
  }),
  switchField: css({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(1.5),
    color: theme.colors.text.primary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  stylesGrid: css({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing(1) }),
  styleTile: css({
    height: 48,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
  }),
  segment: css({
    display: 'inline-flex',
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    overflow: 'hidden',
  }),
  segItem: css({
    padding: theme.spacing(0.25, 1.5),
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  segActive: css({
    padding: theme.spacing(0.25, 1.5),
    background: theme.colors.background.secondary,
    color: theme.colors.text.primary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
