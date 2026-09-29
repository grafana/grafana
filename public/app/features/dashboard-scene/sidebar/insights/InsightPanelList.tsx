import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { SceneGridRow, sceneGraph, type SceneObject, type VizPanel } from '@grafana/scenes';
import { Text, useStyles2 } from '@grafana/ui';
import { getFocusStyles } from '@grafana/ui/internal';

import { RowItem } from '../../scene/layout-rows/RowItem';
import { TabItem } from '../../scene/layout-tabs/TabItem';
import { VizPanelEditableElement } from '../VizPanelEditableElement';

import { getInsightPanelQuestion } from './insightPanels';

interface Props {
  panels: VizPanel[];
}

export function InsightPanelList({ panels }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <section className={styles.section}>
      <Text element="h3" variant="h6">
        <Trans i18nKey="dashboard.insights.panels.title">Insight panels</Trans>
      </Text>
      <ul className={styles.list}>
        {panels.map((panel) => {
          const location = getPanelLocation(panel);
          return (
            <li key={panel.state.key}>
              <button
                type="button"
                className={styles.item}
                onClick={() => new VizPanelEditableElement(panel).scrollIntoView()}
              >
                <span className={styles.question}>
                  {getInsightPanelQuestion(panel) ||
                    t('dashboard.insights.panels.no-question', 'Insight panel without a question')}
                </span>
                {location && (
                  <Text variant="bodySmall" color="secondary">
                    {location}
                  </Text>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Tab and row titles the viewer sees, outermost first. */
function getPanelLocation(panel: VizPanel): string {
  const titles: string[] = [];
  for (let parent = panel.parent; parent; parent = parent.parent) {
    const title = sceneGraph.interpolate(parent, getVisibleTitle(parent)).trim();
    if (title) {
      titles.unshift(title);
    }
  }
  return titles.join(' › ');
}

function getVisibleTitle(sceneObject: SceneObject): string {
  if (sceneObject instanceof TabItem || sceneObject instanceof SceneGridRow) {
    return sceneObject.state.title ?? '';
  }
  if (sceneObject instanceof RowItem && !sceneObject.state.hideHeader) {
    return sceneObject.state.title ?? '';
  }
  return '';
}

function getStyles(theme: GrafanaTheme2) {
  return {
    section: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      '&:not(:first-child)': {
        marginTop: theme.spacing(2),
      },
    }),
    list: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      margin: 0,
      padding: 0,
      listStyle: 'none',
    }),
    item: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: theme.spacing(0.25),
      width: '100%',
      padding: theme.spacing(1),
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      background: theme.colors.background.primary,
      color: theme.colors.text.primary,
      textAlign: 'left',
      overflowWrap: 'anywhere',
      cursor: 'pointer',
      '&:hover': {
        background: theme.colors.action.hover,
      },
      '&:focus-visible': getFocusStyles(theme),
    }),
    question: css({
      fontWeight: theme.typography.fontWeightMedium,
    }),
  };
}
