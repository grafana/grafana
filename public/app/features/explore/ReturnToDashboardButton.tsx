import React, { FC } from 'react';
import { connect } from 'react-redux';
import { hot } from 'react-hot-loader';
import { Icon, Tooltip, ButtonSelect, ToolbarButton, ButtonGroup } from '@grafana/ui';
import { DataQuery } from '@grafana/data';

import kbn from '../../core/utils/kbn';
import { getDashboardSrv } from '../dashboard/services/DashboardSrv';
import { StoreState } from 'app/types';
import { ExploreId } from 'app/types/explore';
import { updateLocation } from 'app/core/actions';
import { setDashboardQueriesToUpdateOnLoad } from '../dashboard/state/reducers';
import { isSplit } from './state/selectors';

interface Props {
  exploreId: ExploreId;
  splitted: boolean;
  queries: DataQuery[];
  originPanelId?: number | null;
  updateLocation: typeof updateLocation;
  setDashboardQueriesToUpdateOnLoad: typeof setDashboardQueriesToUpdateOnLoad;
}

export const UnconnectedReturnToDashboardButton: FC<Props> = ({
  originPanelId,
  updateLocation,
  setDashboardQueriesToUpdateOnLoad,
  queries,
  splitted,
}) => {
  const withOriginId = originPanelId && Number.isInteger(originPanelId);

  // If in split mode, or no origin id, escape early and return null
  if (splitted || !withOriginId) {
    return null;
  }

  const cleanQueries = (queries: DataQuery[]) => {
    return queries.map((query: DataQuery & { context?: string }) => {
      delete query.context;
      delete query.key;
      return query;
    });
  };

  const returnToPanel = async ({ withChanges = false } = {}) => {
    const dashboardSrv = getDashboardSrv();
    const dash = dashboardSrv.getCurrent();
    const titleSlug = kbn.slugifyForUrl(dash.title);

    if (withChanges) {
      setDashboardQueriesToUpdateOnLoad({
        panelId: originPanelId!,
        queries: cleanQueries(queries),
      });
    }

    const query: any = {};

    if (withChanges || dash.panelInEdit) {
      query.editPanel = originPanelId;
    } else if (dash.panelInView) {
      query.viewPanel = originPanelId;
    }

    updateLocation({ path: `/d/${dash.uid}/:${titleSlug}`, query });
  };

  return (
    <ButtonGroup>
      <Tooltip content={'Return to panel'} placement="bottom">
        <ToolbarButton data-testid="returnButton" title={'Return to panel'} onClick={() => returnToPanel()}>
          <Icon name="arrow-left" />
        </ToolbarButton>
      </Tooltip>
      <ButtonSelect
        data-testid="returnButtonWithChanges"
        options={[{ label: 'Return to panel with changes', value: '' }]}
        onChange={() => returnToPanel({ withChanges: true })}
      />
    </ButtonGroup>
  );
};

function mapStateToProps(state: StoreState, { exploreId }: { exploreId: ExploreId }) {
  const explore = state.explore;
  const splitted = isSplit(state);
  const { datasourceInstance, queries, originPanelId } = explore[exploreId]!;

  return {
    exploreId,
    datasourceInstance,
    queries,
    originPanelId,
    splitted,
  };
}

const mapDispatchToProps = {
  updateLocation,
  setDashboardQueriesToUpdateOnLoad,
};
export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(UnconnectedReturnToDashboardButton));
