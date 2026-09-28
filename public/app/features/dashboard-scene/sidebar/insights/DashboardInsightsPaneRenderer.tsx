import { css } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { type SceneComponentProps } from '@grafana/scenes';
import { Alert, Button, ScrollContainer, Sidebar, Text, useStyles2 } from '@grafana/ui';

import { type DashboardInsightsPane } from './DashboardInsightsPane';
import { InsightQuestionForm } from './InsightQuestionForm';
import { InsightQuestionItem } from './InsightQuestionItem';
import { addInsightQuestion } from './insightsEditActions';
import { getInsightsDashboard, readInsightQuestions } from './insightsStorage';
import { getInsightSourcePanels } from './sources';

export function DashboardInsightsPaneRenderer({ model }: SceneComponentProps<DashboardInsightsPane>) {
  const styles = useStyles2(getStyles);
  const { runs, expanded } = model.useState();
  const dashboard = getInsightsDashboard(model);
  // Re-renders on any dashboard state change, including meta, which holds the saved questions.
  const { isEditing } = dashboard.useState();
  const [formTarget, setFormTarget] = useState<{ kind: 'add' } | { kind: 'edit'; id: string }>();

  const { questions, invalid } = readInsightQuestions(dashboard);
  const sources = getInsightSourcePanels(dashboard);
  const isAdding = Boolean(isEditing) && formTarget?.kind === 'add';

  return (
    <div className={styles.wrapper}>
      <Sidebar.PaneHeader title={t('dashboard.insights.pane.title', 'Insights')} />
      <ScrollContainer showScrollIndicators={true}>
        <div className={styles.content}>
          {isEditing && invalid && (
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
              {isEditing
                ? t(
                    'dashboard.insights.pane.empty-edit',
                    'Save questions about this dashboard. Viewers can ask Assistant to answer them from the panels you select.'
                  )
                : t('dashboard.insights.pane.empty-view', 'This dashboard has no saved questions.')}
            </Text>
          )}

          {questions.map((question, index) => (
            <InsightQuestionItem
              key={question.id}
              pane={model}
              dashboard={dashboard}
              questions={questions}
              index={index}
              sources={sources}
              run={runs[question.id]}
              isOpen={expanded.includes(question.id)}
              isEditing={Boolean(isEditing)}
              isFormOpen={formTarget?.kind === 'edit' && formTarget.id === question.id}
              onEdit={() => setFormTarget({ kind: 'edit', id: question.id })}
              onCloseForm={() => setFormTarget(undefined)}
            />
          ))}

          {isEditing &&
            (isAdding ? (
              <div className={styles.addForm}>
                <InsightQuestionForm
                  sources={sources}
                  onSave={(draft) => {
                    addInsightQuestion(dashboard, questions, draft);
                    setFormTarget(undefined);
                  }}
                  onCancel={() => setFormTarget(undefined)}
                />
              </div>
            ) : (
              <div>
                <Button size="sm" variant="secondary" icon="plus" onClick={() => setFormTarget({ kind: 'add' })}>
                  <Trans i18nKey="dashboard.insights.pane.add-question">Add question</Trans>
                </Button>
              </div>
            ))}
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
      gap: theme.spacing(1),
      padding: theme.spacing(2),
    }),
    addForm: css({
      padding: theme.spacing(1.5),
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
    }),
  };
}
