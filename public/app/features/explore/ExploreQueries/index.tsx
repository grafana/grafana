import React, { PropsWithChildren } from 'react';
import { ControlledCollapse, CustomScrollbar } from '@grafana/ui';
import { ExploreId, StoreState } from 'app/types';
import { QueryRows } from '../QueryRows';
import { getExploreItemSelector } from '../state/selectors';
import { useSelector } from 'react-redux';
import { css } from '@emotion/css';

interface Props {
  exploreId: ExploreId;
}

const collapseStyles = css`
  /* Override for Collapse setting its external margin. Ideally components from grafana-ui shouldn't
  make any assumptions on layout. Overriding it here until it's removed from the component itself.
  */
  margin: 0;
`;

export const ExploreQueries = ({ exploreId, children }: PropsWithChildren<Props>) => {
  const selectExploreItem = getExploreItemSelector(exploreId);
  const queries = useSelector((state: StoreState) => selectExploreItem(state)?.queries.length);

  return (
    <>
      {/* ControlledCollapse is actually uncontrolled */}
      <ControlledCollapse label={`Queries (${queries})`} collapsible isOpen className={collapseStyles}>
        <CustomScrollbar autoHeightMax="50vh">
          <QueryRows exploreId={exploreId} />
          {/* TODO: add empty state if queries === 0 */}
        </CustomScrollbar>

        {children}
      </ControlledCollapse>
    </>
  );
};
