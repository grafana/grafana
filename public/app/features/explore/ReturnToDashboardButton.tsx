import React, { FC } from 'react';
import { connect } from 'react-redux';
import { ButtonGroup, ButtonSelect, Icon, ToolbarButton, Tooltip } from '@grafana/ui';
import { DataQuery, urlUtil } from '@grafana/data';

import kbn from '../../core/utils/kbn';
import config from 'app/core/config';
import { getDashboardSrv } from '../dashboard/services/DashboardSrv';
import { StoreState } from 'app/types';
import { ExploreId } from 'app/types/explore';
import { setDashboardQueriesToUpdateOnLoad } from '../dashboard/state/reducers';
import { isSplit } from './state/selectors';
import { locationService } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';

interface Props {
  exploreId: ExploreId;
  splitted: boolean;
  hasAccess: boolean;
  queries: DataQuery[];
  originPanelId?: number | null;
  setDashboardQueriesToUpdateOnLoad: typeof setDashboardQueriesToUpdateOnLoad;
}

export const UnconnectedReturnToDashboardButton: FC<Props> = ({
  originPanelId,
  setDashboardQueriesToUpdateOnLoad,
  queries,
  splitted,
  hasAccess,
}) => {
  const withOriginId = originPanelId && Number.isInteger(originPanelId);

  // If in split mode, no origin id, or user does not have access, escape early and return null
  if (splitted || !withOriginId || !hasAccess) {
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
    if (!dash) {
      return;
    }

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

    locationService.push(urlUtil.renderUrl(`/d/${dash.uid}/:${titleSlug}`, query));
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

  const hasAccess = (): boolean => {
    const roles = ['Editor', 'Admin'];
    if (config.viewersCanEdit) {
      roles.push('Viewer');
    }
    return roles.some((r) => contextSrv.hasRole(r));
  };

  return {
    exploreId,
    datasourceInstance,
    queries,
    originPanelId,
    splitted,
    hasAccess: hasAccess(),
  };
}

const mapDispatchToProps = {
  setDashboardQueriesToUpdateOnLoad,
};

export default connect(mapStateToProps, mapDispatchToProps)(UnconnectedReturnToDashboardButton);
