import { css } from '@emotion/css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { connect } from 'react-redux';

import { EventBusSrv, getTimeZone } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { stopQueryState } from 'app/core/utils/explore';
import { StoreState, useSelector } from 'app/types/store';

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

  useEffect(() => {
    const bus = eventBus.current;
    return () => bus.removeAllListeners();
  }, []);

  return (
    <div className={containerStyles} ref={ref} data-testid={selectors.pages.Explore.General.container}>
      <Explore
        exploreId={exploreId}
        eventBus={eventBus.current}
        showQueryInspector={showQueryInspector}
        setShowQueryInspector={setShowQueryInspector}
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
  const paneRef = useRef<ReturnType<typeof paneSelector>>();
  paneRef.current = useSelector(paneSelector);

  useEffect(() => {
    return () => {
      stopQueryState(paneRef.current?.querySubscription);
    };
  }, []);
}
