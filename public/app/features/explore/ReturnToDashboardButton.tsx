import React, { FC } from 'react';
import classNames from 'classnames';
import { connect } from 'react-redux';
import { hot } from 'react-hot-loader';
import { Icon, Tooltip, LegacyForms } from '@grafana/ui';
import { DataQuery } from '@grafana/data';

import kbn from '../../core/utils/kbn';
import { getDashboardSrv } from '../dashboard/services/DashboardSrv';
import { StoreState } from 'app/types';
import { ExploreId } from 'app/types/explore';
import { updateLocation } from 'app/core/actions';
import { setDashboardQueriesToUpdateOnLoad } from '../dashboard/state/reducers';

const { ButtonSelect } = LegacyForms;

interface Props {
  originPanelId: number;
  exploreId: ExploreId;
  queries: DataQuery[];
  updateLocation: typeof updateLocation;
  setDashboardQueriesToUpdateOnLoad: typeof setDashboardQueriesToUpdateOnLoad;
}

const ReturnToDashboardButton: FC<Props> = ({
  originPanelId,
  updateLocation,
  setDashboardQueriesToUpdateOnLoad,
  queries,
}) => {
  const originDashboardIsEditable = originPanelId && Number.isInteger(originPanelId);
  const panelReturnClasses = classNames('btn', 'navbar-button', {
    'btn--radius-right-0': originDashboardIsEditable,
    'navbar-button navbar-button--border-right-0': originDashboardIsEditable,
  });

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
    <div className="explore-toolbar-content-item">
      <Tooltip content={'Return to panel'} placement="bottom">
        <button className={panelReturnClasses} onClick={() => returnToPanel()}>
          <Icon name="arrow-left" />
        </button>
      </Tooltip>
      {originDashboardIsEditable && (
        <ButtonSelect
          className="navbar-button--attached btn--radius-left-0$"
          options={[{ label: 'Return to panel with changes', value: '' }]}
          onChange={() => returnToPanel({ withChanges: true })}
          maxMenuHeight={380}
        />
      )}
    </div>
  );
};

function mapStateToProps(state: StoreState, { exploreId }: { exploreId: ExploreId }) {
  const explore = state.explore;
  const { datasourceInstance, queries } = explore[exploreId];
  return {
    exploreId,
    datasourceInstance,
    queries,
  };
}

const mapDispatchToProps = {
  updateLocation,
  setDashboardQueriesToUpdateOnLoad,
};
export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(ReturnToDashboardButton));
