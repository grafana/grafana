// Prototype-only. Not internationalized.
// Wrapper that decides whether to render the existing ContentOutline or the
// Option A rail. Used because Explore.tsx is a class component and can't call
// hooks directly.

import { ContentOutline } from '../ContentOutline/ContentOutline';

import { PromMetricsRail } from './PromMetricsRail';
import { usePromPrototype } from './PromPrototypeContext';

interface Props {
  exploreId: string;
  scroller: HTMLElement | undefined;
  panelId: string;
  isPrometheus: boolean;
}

export function ExploreLeftPane({ exploreId, scroller, panelId, isPrometheus }: Props) {
  const { option, pinnedInSession } = usePromPrototype();
  // Option A shows the rail. Option C (assistant) builds ON TOP of A — same
  // rail, just with the assistant popover trigger active. Option B (popover)
  // only shows the rail after the user explicitly pins it. Non-Prometheus
  // datasources always fall back to the vanilla outline.
  const showRail = isPrometheus && (option === 'a' || option === 'c' || (option === 'b' && pinnedInSession));
  if (showRail) {
    return <PromMetricsRail exploreId={exploreId} scroller={scroller} panelId={panelId} />;
  }
  return <ContentOutline scroller={scroller} panelId={panelId} />;
}
