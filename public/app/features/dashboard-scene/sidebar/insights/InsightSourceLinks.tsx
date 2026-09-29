import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Button, Text, useStyles2 } from '@grafana/ui';

import { RowItem } from '../../scene/layout-rows/RowItem';
import { TabItem } from '../../scene/layout-tabs/TabItem';
import { VizPanelEditableElement } from '../VizPanelEditableElement';

import { getInsightSourceTree, getPanelNodes, type InsightSourceNode, type InsightSourceSectionNode } from './sections';
import { type InsightSourcePanel } from './sources';

interface Props {
  /** Panel keys or tab and row references, with a fallback title for sources no longer on the dashboard */
  items: Array<{ key: string; title: string }>;
  sources: InsightSourcePanel[];
}

function findSection(nodes: InsightSourceNode[], ref: string): InsightSourceSectionNode | undefined {
  for (const node of nodes) {
    if (node.kind !== 'panel') {
      const match = node.ref === ref ? node : findSection(node.children, ref);
      if (match) {
        return match;
      }
    }
  }
  return undefined;
}

function goToSection(node: InsightSourceSectionNode) {
  const { object } = node.section;
  if (object instanceof TabItem || object instanceof RowItem) {
    object.scrollIntoView();
    return;
  }
  // Classic dashboard rows cannot scroll themselves into view, so go to their first panel.
  const [first] = getPanelNodes(node.children);
  if (first) {
    new VizPanelEditableElement(first.source.panel).scrollIntoView();
  }
}

export function InsightSourceLinks({ items, sources }: Props) {
  const styles = useStyles2(getStyles);
  const tree = getInsightSourceTree(sources);

  return (
    <ul className={styles.list}>
      {items.map(({ key, title }) => {
        const section = findSection(tree, key);
        const source = sources.find((candidate) => candidate.key === key);
        return (
          <li key={key}>
            {section ? (
              <Button
                size="sm"
                variant="secondary"
                fill="text"
                icon={section.kind === 'tab' ? 'layers' : 'list-ul'}
                tooltip={t('dashboard.insights.sources.go-to-section', 'Go to this section')}
                onClick={() => goToSection(section)}
              >
                {section.location}
              </Button>
            ) : source ? (
              <Button
                size="sm"
                variant="secondary"
                fill="text"
                icon="eye"
                tooltip={t('dashboard.insights.sources.view-panel', 'View panel')}
                onClick={() => locationService.partial({ viewPanel: source.panel.getPathId() })}
              >
                {source.title}
              </Button>
            ) : (
              <Text variant="bodySmall" color="secondary">
                {t('dashboard.insights.sources.unavailable', '{{title}} (unavailable)', { title })}
              </Text>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    list: css({
      listStyle: 'none',
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: theme.spacing(0.5),
    }),
  };
}
