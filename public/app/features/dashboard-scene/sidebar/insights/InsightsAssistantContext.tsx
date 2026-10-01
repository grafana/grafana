import { useEffect, useMemo, useReducer } from 'react';

import { createAssistantContextItem, useProvidePageContext } from '@grafana/assistant';
import { t } from '@grafana/i18n';
import { type InsightOptions } from 'app/plugins/panel/text/panelcfg.gen';
import { getInsightSessions } from 'app/plugins/panel/text/v2/insight/insightSessions';

import { type DashboardScene } from '../../scene/DashboardScene';

import { getInsightPanelOptions, getInsightPanels } from './insightPanels';
import { readInsightQuestions } from './insightsStorage';
import { resolveInsightSourceKeys } from './sections';
import { getInsightSourcePanels } from './sources';

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Gives the Assistant sidebar the dashboard's insight questions with the answers on screen, asked by the viewer or
 * shared by an editor, so the viewer can discuss them without copying them over. Renders nothing.
 */
export function InsightsAssistantContext({ dashboard }: { dashboard: DashboardScene }) {
  const { uid, title } = dashboard.useState();
  const sessions = getInsightSessions(dashboard);
  const [answersVersion, onAnswersChange] = useReducer((value: number) => value + 1, 0);

  useEffect(() => sessions.subscribe(onAnswersChange), [sessions]);
  useEffect(() => sessions.loadShared(), [sessions]);

  const insights = useMemo(
    () => {
      const sources = getInsightSourcePanels(dashboard);
      const titles = new Map(sources.map((source) => [source.key, source.title]));

      const describe = (id: string, options: InsightOptions, shownIn: string) => {
        const question = options.question?.trim();
        if (!question) {
          return [];
        }
        const { result, investigation } = sessions.get(id);
        return [
          {
            question,
            shownIn,
            sourcePanels: resolveInsightSourceKeys(options.sourcePanelKeys ?? [], sources).map(
              (key) => titles.get(key) ?? key
            ),
            latestAnswer: result && {
              headline: result.content.headline,
              findings: result.content.findings.map(({ label, detail }) => ({ label, detail })),
              caveat: result.content.caveat || undefined,
              breakdown: result.content.breakdown,
              timeRange: { from: result.snapshot.from, to: result.snapshot.to },
              answeredAt: result.completedAt,
              sharedBy: result.share?.login,
            },
            investigation:
              investigation?.phase === 'started' ? { state: investigation.state, url: investigation.url } : undefined,
          },
        ];
      };

      return [
        ...getInsightPanels(dashboard).flatMap((panel) =>
          describe(panel.state.key ?? '', getInsightPanelOptions(panel), 'Insight panel')
        ),
        ...readInsightQuestions(dashboard).questions.flatMap((question) =>
          describe(question.id, question, 'Insights sidebar')
        ),
      ];
    },
    // `answersVersion` re-reads the sessions after an answer changes; the callback does not use it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dashboard, sessions, answersVersion]
  );

  const context = useMemo(
    () =>
      insights.length
        ? [
            createAssistantContextItem('structured', {
              title: t('dashboard.insights.assistant-context.title', 'Dashboard insights'),
              data: {
                description:
                  'Questions saved on this dashboard and the answers the viewer has seen. Answers are based on panel data at the time shown, not on live queries.',
                dashboard: title,
                insights,
              },
            }),
          ]
        : [],
    [insights, title]
  );
  const urlPattern = useMemo(() => new RegExp(`^/d/${escapeRegExp(uid ?? '')}(/|$)`), [uid]);
  useProvidePageContext(urlPattern, context);

  return null;
}
