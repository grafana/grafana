import { lazy, Suspense, type ComponentType } from 'react';

import { type StandardEditorProps } from '@grafana/data';
import { Spinner } from '@grafana/ui';

import { type InsightViewProps } from './InsightView';

/**
 * The insight surface reaches into dashboard-scene for source panels and section paths, which
 * pulls the dashboard app in with it. Loaded on demand so a Text panel in any other mode — and
 * the options pane of one — never pays for it.
 */
function withSuspense<P extends object>(displayName: string, load: () => Promise<ComponentType<P>>): ComponentType<P> {
  const Loaded = lazy(() => load().then((component) => ({ default: component })));

  function Wrapper(props: P) {
    return (
      <Suspense fallback={<Spinner />}>
        <Loaded {...props} />
      </Suspense>
    );
  }
  Wrapper.displayName = displayName;

  return Wrapper;
}

export const InsightView = withSuspense<InsightViewProps>('InsightView', () =>
  import(/* webpackChunkName: "text-panel-insight" */ './InsightView').then((m) => m.InsightView)
);

export const InsightQuestionEditor = withSuspense<StandardEditorProps<string>>('InsightQuestionEditor', () =>
  import(/* webpackChunkName: "text-panel-insight-editors" */ './InsightQuestionEditor').then(
    (m) => m.InsightQuestionEditor
  )
);

export const InsightSourcesEditor = withSuspense<StandardEditorProps<string[]>>('InsightSourcesEditor', () =>
  import(/* webpackChunkName: "text-panel-insight-editors" */ './InsightSourcesEditor').then(
    (m) => m.InsightSourcesEditor
  )
);

export const InsightFollowUpsEditor = withSuspense<StandardEditorProps<string[]>>('InsightFollowUpsEditor', () =>
  import(/* webpackChunkName: "text-panel-insight-editors" */ './InsightFollowUpsEditor').then(
    (m) => m.InsightFollowUpsEditor
  )
);
