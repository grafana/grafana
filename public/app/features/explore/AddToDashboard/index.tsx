import React from 'react';
import { DataFrame, DataQuery } from '@grafana/data';
import { ExploreId, StoreState } from 'app/types';
import { useSelector, useDispatch } from 'react-redux';
import { getExploreItemSelector } from '../state/selectors';
import { AddToDashboardButton } from './AddToDashboardButton';
import { addToDashboard, SaveToExistingDashboardDTO, SaveToNewDashboardDTO } from './addToDashboard';
import { FetchError, locationService } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import { createSuccessNotification } from 'app/core/copy/appNotification';

const isVisible = (query: DataQuery) => !query.hide;
const hasRefId = (refId: DataFrame['refId']) => (frame: DataFrame) => frame.refId === refId;

const getMainVisualization = (
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
  const dispatch = useDispatch();
  const selectExploreItem = getExploreItemSelector(exploreId);

  const { queries, mainVisualization } = useSelector((state: StoreState) => {
    const queries = selectExploreItem(state)?.queries || [];
    const { graphFrames, logsFrames, nodeGraphFrames } = selectExploreItem(state)?.queryResponse || {};

    return { queries, mainVisualization: getMainVisualization(queries, graphFrames, logsFrames, nodeGraphFrames) };
  });

  const handleSave = async (data: SaveToNewDashboardDTO | SaveToExistingDashboardDTO, redirect: boolean) => {
    return addToDashboard(data)
      .then(
        redirect
          ? locationService.push
          : () => {
              dispatch(notifyApp(createSuccessNotification('YAY!')));
            }
      )
      .catch((e: FetchError) => {
        // transform an API error into an error handleable by the component
        return { message: e.data.message ?? 'Unknown Error', status: e.data.status ?? 'unknown-error' };
      });
  };

  return <AddToDashboardButton queries={queries} visualization={mainVisualization} onSave={handleSave} />;
};
