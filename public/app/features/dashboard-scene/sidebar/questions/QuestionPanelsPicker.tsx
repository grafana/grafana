import { css } from '@emotion/css';
import { type ReactNode, useId, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph } from '@grafana/scenes';
import { Checkbox, Icon, IconButton, Text, useStyles2 } from '@grafana/ui';

import { getSectionLabel, getSourcePanels, type SourceSection } from '../../questions/sourcePanels';
import { type DashboardSceneLike } from '../../scene/types/dashboard';
import { getPanelIdForVizPanel } from '../../utils/utils-panels';

/** The same icons as the dashboard outline. */
const ICONS = { dashboard: 'apps', tab: 'layers', row: 'list-ul', panel: 'chart-line' } as const;

interface PanelNode {
  kind: 'panel';
  panelId: number;
  label: string;
}

interface SectionNode {
  kind: SourceSection['kind'];
  key: string;
  label: string;
  /** Every panel in the section and the sections inside it. */
  panelIds: number[];
  children: TreeNode[];
}

type TreeNode = PanelNode | SectionNode;

interface Props {
  dashboard: DashboardSceneLike;
  /** IDs of the picked panels. */
  value: number[];
  onChange: (panelIds: number[]) => void;
}

/**
 * The entire dashboard, then its tabs, rows, and panels with queries, in dashboard order, like the dashboard outline.
 * Picking a tab or row picks every panel in it now; panels added to it later are not picked.
 */
export function QuestionPanelsPicker({ dashboard, value, onChange }: Props) {
  const styles = useStyles2(getStyles);
  const id = useId();
  const [expanded, setExpanded] = useState<Set<string>>();

  const tree = getPanelTree(dashboard);
  const allPanelIds = getPanelIds(tree);
  const available = new Set(allPanelIds);
  const picked = new Set(value);
  // A picked panel that was removed from the dashboard stays listed until it is unpicked, so the author sees it.
  const unavailable = value.filter((panelId) => !available.has(panelId));

  if (!tree.length && !unavailable.length) {
    return (
      <Text element="p" variant="bodySmall" color="secondary">
        {t(
          'dashboard.sidebar.questions.sources.no-panels',
          'This dashboard has no panels with queries to answer from.'
        )}
      </Text>
    );
  }

  // Sections holding a picked panel start open, so existing picks are visible.
  const open =
    expanded ?? new Set(getSections(tree).flatMap((node) => (isPartlyPicked(node, picked) ? [node.key] : [])));
  const pickedCount = value.filter((panelId) => available.has(panelId)).length;

  const toggleOpen = (key: string) => {
    const next = new Set(open);
    if (!next.delete(key)) {
      next.add(key);
    }
    setExpanded(next);
  };

  const pick = (panelIds: number[], checked: boolean) => {
    const changed = new Set(panelIds);
    onChange(
      checked
        ? [...value, ...panelIds.filter((panelId) => !picked.has(panelId))]
        : value.filter((panelId) => !changed.has(panelId))
    );
  };

  const renderRow = ({
    inputId,
    icon,
    label,
    panelIds,
    count,
    toggle,
  }: {
    inputId: string;
    icon: (typeof ICONS)[keyof typeof ICONS];
    label: string;
    panelIds: number[];
    count?: number;
    toggle?: ReactNode;
  }) => {
    const all = panelIds.length > 0 && panelIds.every((panelId) => picked.has(panelId));
    return (
      <div className={styles.row}>
        {toggle ?? <span className={styles.toggleSpace} />}
        <Checkbox
          id={inputId}
          value={all}
          indeterminate={!all && panelIds.some((panelId) => picked.has(panelId))}
          onChange={(event) => pick(panelIds, event.currentTarget.checked)}
        />
        <label htmlFor={inputId} className={styles.label}>
          <Icon size="sm" name={icon} />
          <span className={styles.title}>{label}</span>
          {count !== undefined && (
            <span className={styles.count}>
              <Text color="secondary" variant="bodySmall">
                {t('dashboard.sidebar.questions.sources.panel-count', '', {
                  count,
                  defaultValue_one: '{{count}} panel',
                  defaultValue_other: '{{count}} panels',
                })}
              </Text>
            </span>
          )}
        </label>
      </div>
    );
  };

  const renderNodes = (nodes: TreeNode[], idPath: string, nested: boolean): ReactNode => (
    <ul className={nested ? styles.children : styles.tree}>
      {nodes.map((node, index) => {
        const inputId = `${idPath}-${index}`;
        if (node.kind === 'panel') {
          return (
            <li key={inputId}>
              {renderRow({ inputId, icon: ICONS.panel, label: node.label, panelIds: [node.panelId] })}
            </li>
          );
        }
        const isOpen = open.has(node.key);
        return (
          <li key={inputId}>
            {renderRow({
              inputId,
              icon: ICONS[node.kind],
              label: node.label,
              panelIds: node.panelIds,
              count: node.panelIds.length,
              toggle: (
                <IconButton
                  name={isOpen ? 'angle-down' : 'angle-right'}
                  aria-expanded={isOpen}
                  aria-label={
                    isOpen
                      ? t('dashboard.sidebar.questions.sources.collapse', 'Collapse {{name}}', {
                          name: node.label,
                        })
                      : t('dashboard.sidebar.questions.sources.expand', 'Expand {{name}}', {
                          name: node.label,
                        })
                  }
                  onClick={() => toggleOpen(node.key)}
                />
              ),
            })}
            {isOpen && renderNodes(node.children, inputId, true)}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div
      className={styles.picker}
      role="group"
      aria-label={t('dashboard.sidebar.questions.sources.label', 'Source panels')}
    >
      {unavailable.length > 0 && (
        <ul className={styles.tree}>
          {unavailable.map((panelId) => (
            <li key={panelId}>
              <Checkbox
                id={`${id}-unavailable-${panelId}`}
                value
                label={t('dashboard.sidebar.questions.sources.unavailable-panel', 'Panel {{panelId}} (unavailable)', {
                  panelId,
                })}
                onChange={() => pick([panelId], false)}
              />
            </li>
          ))}
        </ul>
      )}
      {tree.length > 0 && (
        <ul className={styles.tree}>
          <li>
            {renderRow({
              inputId: `${id}-dashboard`,
              icon: ICONS.dashboard,
              label: t('dashboard.sidebar.questions.sources.entire-dashboard', 'Entire dashboard'),
              panelIds: allPanelIds,
              count: allPanelIds.length,
            })}
          </li>
        </ul>
      )}
      {renderNodes(tree, id, false)}
      {pickedCount > 0 && (
        <Text color="secondary" variant="bodySmall">
          {t('dashboard.sidebar.questions.sources.picked-count', '', {
            count: pickedCount,
            defaultValue_one: '{{count}} panel picked',
            defaultValue_other: '{{count}} panels picked',
          })}
        </Text>
      )}
    </div>
  );
}

/** Tabs, rows, and panels with queries, in dashboard order. Sections without such panels are left out. */
function getPanelTree(dashboard: DashboardSceneLike): TreeNode[] {
  const root: TreeNode[] = [];
  for (const source of getSourcePanels(dashboard)) {
    const panelId = getPanelIdForVizPanel(source.panel);
    let level = root;
    for (const section of source.sections) {
      const key = section.object.state.key ?? '';
      let node = level.find(
        (candidate): candidate is SectionNode => candidate.kind !== 'panel' && candidate.key === key
      );
      if (!node) {
        node = { kind: section.kind, key, label: formatSection(section), panelIds: [], children: [] };
        level.push(node);
      }
      node.panelIds.push(panelId);
      level = node.children;
    }
    level.push({ kind: 'panel', panelId, label: sceneGraph.interpolate(source.panel, source.title) });
  }
  return root;
}

function getPanelIds(nodes: TreeNode[]): number[] {
  return nodes.flatMap((node) => (node.kind === 'panel' ? [node.panelId] : node.panelIds));
}

function getSections(nodes: TreeNode[]): SectionNode[] {
  return nodes.flatMap((node) => (node.kind === 'panel' ? [] : [node, ...getSections(node.children)]));
}

function isPartlyPicked(node: SectionNode, picked: Set<number>): boolean {
  return node.panelIds.some((panelId) => picked.has(panelId));
}

function formatSection(section: SourceSection): string {
  if (getSectionLabel(section)) {
    return getSectionLabel(section);
  }
  return section.kind === 'tab'
    ? t('dashboard.sidebar.questions.sources.untitled-tab', 'Untitled tab')
    : t('dashboard.sidebar.questions.sources.untitled-row', 'Untitled row');
}

function getStyles(theme: GrafanaTheme2) {
  const list = { margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' as const };
  return {
    picker: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
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
    }),
    // The options pane is narrow, so a long title wraps rather than hiding the rest of it.
    title: css({
      minWidth: 0,
      overflowWrap: 'anywhere',
    }),
    count: css({
      flexShrink: 0,
      whiteSpace: 'nowrap',
    }),
  };
}
