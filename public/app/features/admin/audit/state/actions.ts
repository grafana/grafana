import { debounce } from 'lodash';

import { getBackendSrv } from '@grafana/runtime';
import { accessControlQueryParam } from 'app/core/utils/accessControl';
import { ThunkResult } from 'app/types';

import {
  auditRecordsLoaded,
  auditRecordsFetchBegin,
  auditRecordsFetchEnd,
  pageChanged,
  searchQueryChanged,
} from './reducers';

export function loadAuditRecords(): ThunkResult<void> {
  return async (dispatch, getState) => {
    try {
      const { perPage, page, searchQuery } = getState().records;
      const records = await getBackendSrv().get(
        `/api/admin/audit`,
        accessControlQueryParam({ perpage: perPage, page, query: searchQuery })
      );
      dispatch(auditRecordsLoaded(records));
    } catch (error) {
      auditRecordsFetchEnd();
    }
  };
}

const fetchAuditRecordsWithDebounce = debounce((dispatch) => dispatch(loadAuditRecords()), 300);

export function changePage(page: number): ThunkResult<void> {
  return async (dispatch) => {
    dispatch(auditRecordsFetchBegin());
    dispatch(pageChanged(page));
    dispatch(loadAuditRecords());
  };
}

export function changeSearchQuery(query: string): ThunkResult<void> {
  return async (dispatch) => {
    dispatch(auditRecordsFetchBegin());
    dispatch(searchQueryChanged(query));
    fetchAuditRecordsWithDebounce(dispatch);
  };
}
