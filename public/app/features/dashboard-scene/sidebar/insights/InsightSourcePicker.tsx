import { css } from '@emotion/css';
import { type ReactNode, useId, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Checkbox, Icon, Text, useStyles2 } from '@grafana/ui';

import {
  getInsightSourceTree,
  getMissingRefLabel,
  getPanelNodes,
  getRefs,
  type InsightSourceNode,
  type InsightSourceSectionNode,
} from './sections';
import { type InsightSourcePanel } from './sources';

/** The same icons as the dashboard outline. */
const ICONS = { tab: 'layers', row: 'list-ul', panel: 'chart-line' } as const;

interface Props {
  sources: InsightSourcePanel[];
  value: string[];
  onChange: (value: string[]) => void;
}

function indexNodes(nodes: InsightSourceNode[], index = new Map<string, InsightSourceNode>()) {
  for (const node of nodes) {
    index.set(node.ref, node);
    if (node.kind !== 'panel') {
      indexNodes(node.children, index);
    }
  }
  return index;
}

function panelCount(count: number): string {
  return t('dashboard.insights.picker.panel-count', '', {
    count,
    defaultValue_one: '{{count}} panel',
    defaultValue_other: '{{count}} panels',
  });
}

/** Tabs, rows, and panels in dashboard order. A selected tab or row includes everything inside it. */
export function InsightSourcePicker({ sources, value, onChange }: Props) {
  const styles = useStyles2(getStyles);
  const id = useId();
  const [expanded, setExpanded] = useState<Set<string>>();

  const tree = getInsightSourceTree(sources);
  if (!tree.length && !value.length) {
    return (
      <Text element="p" color="secondary">
        {t('dashboard.insights.picker.empty', 'This dashboard has no panels with queries yet.')}
      </Text>
    );
  }

  const selected = new Set(value);
  const nodes = indexNodes(tree);
  const missing = value.filter((ref) => !nodes.has(ref));
  const hasSelectionInside = (section: InsightSourceSectionNode) =>
    getRefs(section.children).some((ref) => selected.has(ref));
  // Start with the sections that hold a selected item open, so existing choices are visible.
  const open =
    expanded ??
    new Set(
      [...nodes.values()].flatMap((node) => (node.kind !== 'panel' && hasSelectionInside(node) ? [node.ref] : []))
    );
  const covered = new Set(
    value.flatMap((ref) => {
      const node = nodes.get(ref);
      return node ? getPanelNodes([node]).map((panel) => panel.ref) : [];
    })
  );

  const toggleOpen = (ref: string) => {
    const next = new Set(open);
    if (!next.delete(ref)) {
      next.add(ref);
    }
    setExpanded(next);
  };

  const select = (node: InsightSourceNode, checked: boolean) => {
    if (!checked) {
      onChange(value.filter((ref) => ref !== node.ref));
      return;
    }
    const inside = new Set(node.kind === 'panel' ? [] : getRefs(node.children));
    onChange([...value.filter((ref) => !inside.has(ref)), node.ref]);
  };

  const renderNodes = (list: InsightSourceNode[], idPath: string, includedIn?: string): ReactNode => (
    <ul className={idPath === id ? styles.tree : styles.children}>
      {list.map((node, index) => {
        const inputId = `${idPath}-${index}`;
        const checked = Boolean(includedIn) || selected.has(node.ref);
        const isSection = node.kind !== 'panel';
        const isOpen = isSection && open.has(node.ref);
        return (
          <li key={inputId}>
            <div className={styles.row}>
              {isSection ? (
                <button
                  type="button"
                  className={styles.toggle}
                  aria-expanded={isOpen}
                  aria-label={
                    isOpen
                      ? t('dashboard.insights.picker.collapse', 'Collapse {{label}}', { label: node.label })
                      : t('dashboard.insights.picker.expand', 'Expand {{label}}', { label: node.label })
                  }
                  onClick={() => toggleOpen(node.ref)}
                >
                  <Icon name={isOpen ? 'angle-down' : 'angle-right'} />
                </button>
              ) : (
                <span className={styles.toggleSpace} />
              )}
              <Checkbox
                id={inputId}
                value={checked}
                indeterminate={isSection && !checked && hasSelectionInside(node)}
                disabled={Boolean(includedIn)}
                onChange={(event) => select(node, event.currentTarget.checked)}
              />
              <label
                htmlFor={inputId}
                className={styles.label}
                data-included={includedIn ? '' : undefined}
                title={
                  includedIn
                    ? t('dashboard.insights.picker.included', 'Included with {{label}}', { label: includedIn })
                    : undefined
                }
              >
                <Icon size="sm" name={ICONS[node.kind]} />
                <span className={styles.title}>{node.label}</span>
                {isSection && (
                  <Text color="secondary" variant="bodySmall">
                    {panelCount(getPanelNodes(node.children).length)}
                  </Text>
                )}
              </label>
            </div>
            {isSection &&
              isOpen &&
              renderNodes(node.children, inputId, includedIn ?? (checked ? node.label : undefined))}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className={styles.picker}>
      {missing.length > 0 && (
        <ul className={styles.tree} aria-label={t('dashboard.insights.picker.unavailable-list', 'Unavailable sources')}>
          {missing.map((ref) => (
            <li key={ref}>
              <Checkbox
                value
                label={t('dashboard.insights.picker.unavailable', '{{label}} (unavailable)', {
                  label: getMissingRefLabel(ref),
                })}
                onChange={() => onChange(value.filter((other) => other !== ref))}
              />
            </li>
          ))}
        </ul>
      )}
      {renderNodes(tree, id)}
      {covered.size > 0 && (
        <Text color="secondary" variant="bodySmall">
          {t('dashboard.insights.picker.selected', '', {
            count: covered.size,
            defaultValue_one: '{{count}} panel selected',
            defaultValue_other: '{{count}} panels selected',
          })}
        </Text>
      )}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  const list = { margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' as const };
  return {
    picker: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    }),
    tree: css({
      ...list,
      gap: theme.spacing(0.5),
    }),
    // The tree line sits under the parent's collapse control, like the dashboard outline.
    children: css({
      ...list,
      gap: theme.spacing(0.5),
      marginTop: theme.spacing(0.5),
      marginLeft: theme.spacing(1),
      paddingLeft: theme.spacing(1.5),
      borderLeft: `1px solid ${theme.colors.border.weak}`,
    }),
    row: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      minWidth: 0,
    }),
    toggle: css({
      flexShrink: 0,
      width: theme.spacing(2),
      padding: 0,
      border: 'none',
      borderRadius: theme.shape.radius.default,
      background: 'transparent',
      color: 'inherit',
      lineHeight: 0,
      cursor: 'pointer',
    }),
    toggleSpace: css({
      flexShrink: 0,
      width: theme.spacing(2),
    }),
    label: css({
      flex: 1,
      minWidth: 0,
      margin: 0,
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      cursor: 'pointer',
      '&[data-included]': {
        cursor: 'default',
      },
    }),
    title: css({
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
  };
}
