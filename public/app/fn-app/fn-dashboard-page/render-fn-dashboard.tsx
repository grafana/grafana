import { merge } from 'lodash';
import React, { useEffect, FC } from 'react';
import { useDispatch } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';

/* eslint-disable-next-line  */
import { locationService as locationSrv, HistoryWrapper } from '@grafana/runtime';
import { setInitialMountState, updateFnState } from 'app/core/reducers/fn-slice';
import DashboardPage, {
  Props,
  MapStateToDashboardPageProps,
  MappedDispatch,
} from 'app/features/dashboard/containers/DashboardPage';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { cancelVariables } from 'app/features/variables/state/actions';
import { DashboardRoutes, StoreState, useSelector } from 'app/types';

import { Themeable2 } from '../../../../packages/grafana-ui/src/types/theme';
import { FNDashboardProps } from '../types';

type DashboardPageProps = Omit<
  Props,
  keyof ReturnType<MapStateToDashboardPageProps> | keyof MappedDispatch | keyof Themeable2
>;

/* eslint-disable-next-line  */
const locationService = locationSrv as HistoryWrapper;

const DEFAULT_DASHBOARD_PAGE_PROPS: Pick<DashboardPageProps, 'isFNDashboard' | 'history' | 'route'> & {
  match: Pick<DashboardPageProps['match'], 'isExact' | 'path' | 'url'>;
} = {
  isFNDashboard: true,
  match: {
    isExact: true,
    path: '/d/:uid/:slug?',
    url: '',
  },
  /* eslint-disable-next-line  */
  history: {} as DashboardPageProps['history'],
  route: {
    routeName: DashboardRoutes.Normal,
    path: '/d/:uid/:slug?',
    pageClass: 'page-dashboard',
    component: DashboardPage,
  },
};

export const RenderFNDashboard: FC<FNDashboardProps> = (props) => {
  const { queryParams, uid, slug, theme, controlsContainer, pageTitle = '', hiddenVariables, setErrors } = props;

  const dispatch = useDispatch<ThunkDispatch<any, any, any>>();

  const firstError = useSelector((state: StoreState) => {
    const { appNotifications } = state;

    return Object.values(appNotifications.byId).find(({ severity }) => severity === 'error');
  });

  /**
   * NOTE:
   * Grafana renders notifications in StoredNotifications component.
   * We do not use this component in FN.
   * But we would like to propagate grafana's errors to FN.
   */
  useEffect(() => {
    setErrors(firstError ? { [firstError.timestamp]: firstError.text } : {});
  }, [firstError, setErrors]);

  useEffect(() => {
    console.log('[FN Grafana] Trying to set initial state...');

    dispatch(
      setInitialMountState({
        FNDashboard: true,
        uid,
        slug,
        theme,
        controlsContainer,
        pageTitle,
        queryParams,
        hiddenVariables,
      })
    );

    // TODO: catch success in redux-thunk way
    console.log(
      '[FN Grafana] Successfully set initial state.',
      locationService.getLocation(),
      locationService.getHistory,
      'location params'
    );

    locationService.fnPathnameChange(window.location.pathname, queryParams);

    return () => {
      getTimeSrv().stopAutoRefresh();
      dispatch(
        updateFnState({
          type: 'FNDashboard',
          payload: false,
        })
      );
      dispatch(cancelVariables(uid));
    };
  }, [dispatch, uid, slug, theme, controlsContainer, pageTitle, hiddenVariables, queryParams]);

  const dashboardPageProps: DashboardPageProps = merge({}, DEFAULT_DASHBOARD_PAGE_PROPS, {
    ...DEFAULT_DASHBOARD_PAGE_PROPS,
    match: {
      params: {
        ...props,
      },
    },
    location: locationService.getLocation(),
    queryParams,
    hiddenVariables,
    controlsContainer,
  });

  return <DashboardPage {...dashboardPageProps} />;
};
