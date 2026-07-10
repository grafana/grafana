import { css } from '@emotion/css';
import { type Dispatch, type SetStateAction, useEffect, useMemo, useRef, useState } from 'react';
import { connect } from 'react-redux';

import { EventBusSrv, getTimeZone } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { stopQueryState } from 'app/core/utils/explore';
import { type StoreState, useSelector } from 'app/types/store';

import Explore from './Explore';
import ExploreQueryInspector from './ExploreQueryInspector';
import { getExploreItemSelector } from './state/selectors';

const containerStyles = css({
  label: 'explorePaneContainer',
  display: 'flex',
  flexDirection: 'column',
  minWidth: '600px',
  height: '100%',
});

interface Props {
  exploreId: string;
}

/*
  Connected components subscribe to the store before function components (using hooks) and can react to store changes. Thus, this connector function is called before the parent component (ExplorePage) is rerendered.
  This means that child components' mapStateToProps will be executed with a zombie `exploreId` that is not present anymore in the store if the pane gets closed.
  By connecting this component and returning the pane we workaround the zombie children issue here instead of modifying every children.
  This is definitely not the ideal solution and we should in the future invest more time in exploring other approaches to better handle this scenario, potentially by refactoring panels to be function components
  (therefore immune to this behaviour), or by forbidding them to access the store directly and instead pass them all the data they need via props or context.

  You can read more about this issue here: https://react-redux.js.org/api/hooks#stale-props-and-zombie-children
*/
function ExplorePaneContainerUnconnected({ exploreId }: Props) {
  useStopQueries(exploreId);
  const eventBus = useRef(new EventBusSrv());
  const ref = useRef(null);
  const [showQueryInspector, setShowQueryInspector] = useState(false);
  const [queryFlowRefIds, setQueryFlowRefIds] = useState<string[]>([]);

  useEffect(() => {
    const bus = eventBus.current;
    return () => bus.removeAllListeners();
  }, []);

  usePruneQueryFlowRefIds(exploreId, setQueryFlowRefIds);

  return (
    <div className={containerStyles} ref={ref} data-testid={selectors.pages.Explore.General.container}>
      <Explore
        exploreId={exploreId}
        eventBus={eventBus.current}
        showQueryInspector={showQueryInspector}
        setShowQueryInspector={setShowQueryInspector}
        queryFlowRefIds={queryFlowRefIds}
        setQueryFlowRefIds={setQueryFlowRefIds}
      />
      {showQueryInspector && (
        <ExploreQueryInspector
          exploreId={exploreId}
          onClose={() => setShowQueryInspector(false)}
          timeZone={getTimeZone()}
        />
      )}
    </div>
  );
}

function mapStateToProps(state: StoreState, props: Props) {
  const pane = state.explore.panes[props.exploreId];

  return { pane };
}

const connector = connect(mapStateToProps);

export const ExplorePaneContainer = connector(ExplorePaneContainerUnconnected);

function useStopQueries(exploreId: string) {
  const paneSelector = useMemo(() => getExploreItemSelector(exploreId), [exploreId]);
  const paneRef = useRef<ReturnType<typeof paneSelector>>(undefined);
  paneRef.current = useSelector(paneSelector);

  useEffect(() => {
    return () => {
      stopQueryState(paneRef.current?.querySubscription);
    };
  }, []);
}

/**
 * Drops open QueryFlow panels whose query row was removed. Without this, deleting a query row (or
 * removing the pane) left a `queryFlowRefIds` entry with nothing to render for, so the panel stuck
 * around empty until the pane itself unmounted.
 */
export function usePruneQueryFlowRefIds(exploreId: string, setQueryFlowRefIds: Dispatch<SetStateAction<string[]>>) {
  // Joined into a stable string so the effect doesn't re-run on every render from a fresh array
  // reference — only when the actual set of refIds changes.
  const currentRefIdsKey = useSelector(
    (state: StoreState) => state.explore.panes[exploreId]?.queries?.map((q) => q.refId).join(',') ?? ''
  );

  useEffect(() => {
    const currentRefIds = new Set(currentRefIdsKey ? currentRefIdsKey.split(',') : []);
    setQueryFlowRefIds((prev) => {
      const next = prev.filter((refId) => currentRefIds.has(refId));
      return next.length === prev.length ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRefIdsKey]);
}
