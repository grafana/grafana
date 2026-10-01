import { css } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { type SceneComponentProps } from '@grafana/scenes';
import { Alert, Button, ScrollContainer, Sidebar, Text, useStyles2 } from '@grafana/ui';

import { isInsightComplete } from '../../insight-panel/InsightQuestionFields';

import { type DashboardInsightsPane } from './DashboardInsightsPane';
import { InsightAskAllButton } from './InsightAskAllButton';
import { InsightCard } from './InsightCard';
import { InsightPanelItem } from './InsightPanelItem';
import { InsightQuestionForm } from './InsightQuestionForm';
import { InsightQuestionItem } from './InsightQuestionItem';
import { getInsightPanelOptions, getInsightPanels } from './insightPanels';
import { addInsightQuestion } from './insightsEditActions';
import { getInsightsDashboard, readInsightQuestions } from './insightsStorage';
import { getInsightSourcePanels } from './sources';

export function DashboardInsightsPaneRenderer({ model }: SceneComponentProps<DashboardInsightsPane>) {
  const styles = useStyles2(getStyles);
  const dashboard = getInsightsDashboard(model);
  // Re-renders on any dashboard state change, including meta, which holds the saved questions.
  const { isEditing, meta } = dashboard.useState();
  const [formTarget, setFormTarget] = useState<{ kind: 'add' } | { kind: 'edit'; id: string }>();

  const { questions, invalid } = readInsightQuestions(dashboard);
  const insightPanels = getInsightPanels(dashboard);
  // Saved questions live in a k8s annotation, so only dashboards with k8s metadata can store them.
  const canAuthor = Boolean(isEditing && meta.k8s);
  const sources = canAuthor ? getInsightSourcePanels(dashboard) : [];
  const isAdding = canAuthor && formTarget?.kind === 'add';
  const showQuestions = canAuthor || questions.length > 0;
  const showHeadings = showQuestions && insightPanels.length > 0;
  const askable = [
    ...insightPanels.map((panel) => ({ id: panel.state.key ?? '', question: getInsightPanelOptions(panel) })),
    ...questions.map((question) => ({ id: question.id, question })),
  ].filter(({ id, question }) => id && isInsightComplete(question));

  return (
    <div className={styles.wrapper}>
      <Sidebar.PaneHeader title={t('dashboard.insights.pane.title', 'Insights')}>
        {askable.length > 1 && <InsightAskAllButton dashboard={dashboard} items={askable} />}
      </Sidebar.PaneHeader>
      <ScrollContainer showScrollIndicators={true}>
        <div className={styles.content}>
          {insightPanels.length > 0 && (
            <section className={styles.section}>
              {showHeadings && (
                <Text element="h3" variant="h6">
                  <Trans i18nKey="dashboard.insights.panels.title">Insight panels</Trans>
                </Text>
              )}
              {insightPanels.map((panel) => (
                <InsightPanelItem key={panel.state.key} dashboard={dashboard} panel={panel} canAuthor={canAuthor} />
              ))}
            </section>
          )}

          {showQuestions && (
            <section className={styles.section}>
              {showHeadings && (
                <Text element="h3" variant="h6">
                  <Trans i18nKey="dashboard.insights.pane.questions-title">Saved questions</Trans>
                </Text>
              )}

              {canAuthor && invalid && (
                <Alert
                  severity="warning"
                  title={t('dashboard.insights.pane.invalid-title', 'Saved questions could not be read')}
                  bottomSpacing={0}
                >
                  <Trans i18nKey="dashboard.insights.pane.invalid-body">
                    Adding or changing a question replaces the saved questions. Undo restores them.
                  </Trans>
                </Alert>
              )}

              {questions.length === 0 && !isAdding && (
                <Text element="p" color="secondary">
                  <Trans i18nKey="dashboard.insights.pane.empty-edit">
                    Save questions about this dashboard. Viewers can ask Assistant to answer them from the panels you
                    select.
                  </Trans>
                </Text>
              )}

              {questions.map((question, index) => (
                <InsightQuestionItem
                  key={question.id}
                  dashboard={dashboard}
                  questions={questions}
                  index={index}
                  sources={sources}
                  isEditing={canAuthor}
                  isFormOpen={formTarget?.kind === 'edit' && formTarget.id === question.id}
                  onEdit={() => setFormTarget({ kind: 'edit', id: question.id })}
                  onCloseForm={() => setFormTarget(undefined)}
                />
              ))}

              {canAuthor &&
                (isAdding ? (
                  <InsightCard>
                    <InsightQuestionForm
                      dashboard={dashboard}
                      sources={sources}
                      onSave={(draft) => {
                        addInsightQuestion(dashboard, questions, draft);
                        setFormTarget(undefined);
                      }}
                      onCancel={() => setFormTarget(undefined)}
                    />
                  </InsightCard>
                ) : (
                  <div>
                    <Button size="sm" variant="secondary" icon="plus" onClick={() => setFormTarget({ kind: 'add' })}>
                      <Trans i18nKey="dashboard.insights.pane.add-question">Add question</Trans>
                    </Button>
                  </div>
                ))}
            </section>
          )}

          {!showQuestions && insightPanels.length === 0 && (
            <Text element="p" color="secondary">
              <Trans i18nKey="dashboard.insights.pane.empty">This dashboard has no insights.</Trans>
            </Text>
          )}
        </div>
      </ScrollContainer>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 0',
      height: '100%',
    }),
    content: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(3),
      padding: theme.spacing(2),
    }),
    section: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    }),
  };
}
