import { merge, isEmpty, isFunction } from 'lodash';
import React, { useEffect, FC, useMemo } from 'react';
import { useDispatch } from 'react-redux';

import { locationService as locationSrv, HistoryWrapper } from '@grafana/runtime';
import { setInitialMountState } from 'app/core/reducers/fn-slice';
import DashboardPage, { DashboardPageProps } from 'app/features/dashboard/containers/DashboardPage';
import { FnLoggerService } from 'app/fn_logger';
import { DashboardRoutes, StoreState, useSelector } from 'app/types';

import { FNDashboardProps } from '../types';

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
  
  history: {} as DashboardPageProps['history'],
  route: {
    routeName: DashboardRoutes.Normal,
    path: '/d/:uid/:slug?',
    pageClass: 'page-dashboard',
    component: DashboardPage,
  },
};

export const RenderFNDashboard: FC<FNDashboardProps> = (props) => {
  const {
    queryParams,
    uid,
    slug,
    mode,
    controlsContainer,
    pageTitle = '',
    setErrors,
    fnLoader,
  } = props;

  const dispatch = useDispatch();

  const firstError = useSelector((state: StoreState) => {
    const { appNotifications } = state;

    return Object.values(appNotifications.byId).find(({ severity }) => severity === 'error');
  });

  const hiddenVariables = useSelector(({ fnGlobalState: { hiddenVariables } }: StoreState) => hiddenVariables);

  /**
   * NOTE:
   * Grafana renders notifications in StoredNotifications component.
   * We do not use this component in FN.
   * But we would like to propagate grafana's errors to FN.
   */
  useEffect(() => {
    if (!isFunction(setErrors)) {
      return;
    }

    setErrors(firstError ? { [firstError.timestamp]: firstError.text } : {});
  }, [firstError, setErrors]);

  useEffect(() => {
    FnLoggerService.log(null, '[FN Grafana] Trying to set initial state...');

    dispatch(
      setInitialMountState({
        FNDashboard: true,
        uid,
        slug,
        mode,
        controlsContainer,
        pageTitle,
        queryParams,
      })
    );

    // TODO: catch success in redux-thunk way
    FnLoggerService.log(
      null,
      '[FN Grafana] Successfully set initial state.',
      locationService.getLocation(),
      locationService.getHistory,
      'location params'
    );

    locationService.fnPathnameChange(window.location.pathname, queryParams);

  }, [dispatch, uid, slug, controlsContainer, pageTitle, queryParams, mode]);

  const dashboardPageProps: DashboardPageProps = useMemo(() => merge({}, DEFAULT_DASHBOARD_PAGE_PROPS, {
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
    fnLoader,
  }),[controlsContainer, fnLoader, hiddenVariables, props, queryParams]);

  return isEmpty(queryParams || {}) ? <>{fnLoader}</> : <DashboardPage {...dashboardPageProps} />;
};
