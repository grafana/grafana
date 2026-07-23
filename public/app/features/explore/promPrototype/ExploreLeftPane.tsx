// Prototype-only. Not internationalized.
// Wrapper that decides whether to render the existing ContentOutline or the
// Option A rail. Used because Explore.tsx is a class component and can't call
// hooks directly.

import { ContentOutline } from '../ContentOutline/ContentOutline';

import { MixedQueryRail } from './MixedQueryRail';
import { usePromPrototype } from './PromPrototypeContext';

interface Props {
  exploreId: string;
  scroller: HTMLElement | undefined;
  panelId: string;
  isPrometheus: boolean;
  isMixed: boolean;
}

export function ExploreLeftPane({ exploreId, scroller, panelId, isPrometheus, isMixed }: Props) {
  const { option, pinnedInSession } = usePromPrototype();
  // Both Mixed and single Prometheus panes use the same query-card rail so the
  // experience is consistent. Mixed always shows it; single Prometheus shows it
  // for Option A/C (and Option B once pinned). Everything else falls back to the
  // vanilla outline.
  const showRail =
    isMixed || (isPrometheus && (option === 'a' || option === 'c' || (option === 'b' && pinnedInSession)));
  if (showRail) {
    return <MixedQueryRail exploreId={exploreId} scroller={scroller} />;
  }
  return <ContentOutline scroller={scroller} panelId={panelId} />;
}
