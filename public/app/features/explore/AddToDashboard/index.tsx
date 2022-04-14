import React, { useState } from 'react';
import { DataFrame, DataQuery } from '@grafana/data';
import { ExploreId, StoreState } from 'app/types';
import { useSelector, useDispatch } from 'react-redux';
import { getExploreItemSelector } from '../state/selectors';
import { addToDashboard, SaveToNewDashboardDTO } from './addToDashboard';
import { locationService } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { ToolbarButton } from '@grafana/ui';
import { AddToDashboardModal, ErrorResponse } from './AddToDashboardModal';

const isVisible = (query: DataQuery) => !query.hide;
const hasRefId = (refId: DataFrame['refId']) => (frame: DataFrame) => frame.refId === refId;

const getMainPanel = (
  queries: DataQuery[],
  graphFrames?: DataFrame[],
  logsFrames?: DataFrame[],
  nodeGraphFrames?: DataFrame[]
) => {
  for (const { refId } of queries.filter(isVisible)) {
    // traceview is not supported in dashboards, skipping it for now.
    const hasQueryRefId = hasRefId(refId);
    if (graphFrames?.some(hasQueryRefId)) {
      return 'timeseries';
    }
    if (logsFrames?.some(hasQueryRefId)) {
      return 'logs';
    }
    if (nodeGraphFrames?.some(hasQueryRefId)) {
      return 'nodeGraph';
    }
  }

  // falling back to table
  return 'table';
};

interface Props {
  exploreId: ExploreId;
}

export const AddToDashboard = ({ exploreId }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const dispatch = useDispatch();
  const selectExploreItem = getExploreItemSelector(exploreId);

  const { queries, panel, datasource } = useSelector((state: StoreState) => {
    const exploreItem = selectExploreItem(state);
    const queries = exploreItem?.queries || [];
    const datasource = exploreItem?.datasourceInstance;
    const { graphFrames, logsFrames, nodeGraphFrames } = exploreItem?.queryResponse || {};

    return {
      queries,
      datasource: { type: datasource?.type, uid: datasource?.uid },
      panel: getMainPanel(queries, graphFrames, logsFrames, nodeGraphFrames),
    };
  });

  const handleSave = async (data: SaveToNewDashboardDTO, redirect: boolean): Promise<void | ErrorResponse> => {
    try {
      const redirectURL = await addToDashboard(data, {
        queries,
        datasource,
        panel,
      });

      if (redirect) {
        locationService.push(redirectURL);
      } else {
        dispatch(notifyApp(createSuccessNotification(`Panel saved to ${data.dashboardName}`)));
        setIsOpen(false);
      }
      return;
    } catch (e) {
      return { message: e.data?.message, status: e.data?.status ?? 'unknown-error' };
    }
  };

  return (
    <>
      <ToolbarButton
        icon="apps"
        onClick={() => setIsOpen(true)}
        aria-label="Add to dashboard"
        disabled={queries.length === 0}
      >
        Add to dashboard
      </ToolbarButton>

      {isOpen && <AddToDashboardModal onClose={() => setIsOpen(false)} onSave={handleSave} />}
    </>
  );
};
