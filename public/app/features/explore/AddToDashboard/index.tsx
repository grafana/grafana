import React, { useState } from 'react';
import { DataFrame, DataQuery, locationUtil } from '@grafana/data';
import { ExploreId, ExplorePanelData, StoreState } from 'app/types';
import { useSelector } from 'react-redux';
import { getExploreItemSelector } from '../state/selectors';
import { addToDashboard } from './addToDashboard';
import { locationService } from '@grafana/runtime';
import { useAppNotification } from 'app/core/copy/appNotification';
import { ToolbarButton } from '@grafana/ui';
import { AddToDashboardModal } from './AddToDashboardModal';
import { FormDTO, ErrorResponse } from './types';

const isVisible = (query: DataQuery) => !query.hide;
const hasRefId = (refId: DataFrame['refId']) => (frame: DataFrame) => frame.refId === refId;

const getMainPanel = (queries: DataQuery[], queryResponse?: ExplorePanelData) => {
  if (!queryResponse) {
    // return table if no response
    return 'table';
  }

  for (const { refId } of queries.filter(isVisible)) {
    // traceview is not supported in dashboards, skipping it for now.
    const hasQueryRefId = hasRefId(refId);
    if (queryResponse.graphFrames.some(hasQueryRefId)) {
      return 'timeseries';
    }
    if (queryResponse.logsFrames.some(hasQueryRefId)) {
      return 'logs';
    }
    if (queryResponse.nodeGraphFrames.some(hasQueryRefId)) {
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
  const { success } = useAppNotification();
  const selectExploreItem = getExploreItemSelector(exploreId);

  const { queries, panel, datasource } = useSelector((state: StoreState) => {
    const exploreItem = selectExploreItem(state);
    const queries = exploreItem?.queries || [];
    const datasource = exploreItem?.datasourceInstance;

    return {
      queries,
      datasource: { type: datasource?.type, uid: datasource?.uid },
      panel: getMainPanel(queries, exploreItem?.queryResponse),
    };
  });

  const handleSave = async (data: FormDTO, redirect: boolean): Promise<void | ErrorResponse> => {
    try {
      const { name, url } = await addToDashboard(data, {
        queries,
        datasource,
        panel,
      });

      setIsOpen(false);
      if (redirect) {
        locationService.push(locationUtil.stripBaseFromUrl(url));
      } else {
        success(`Panel saved to ${name}`);
      }
      return;
    } catch (e) {
      return { message: e?.data?.message, status: e?.data?.status ?? 'unknown-error' };
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
