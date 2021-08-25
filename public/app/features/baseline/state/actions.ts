import { BaselineEntryFields } from '../types';
import { ThunkResult } from '../../../types';
import { setUpdating, initLoadingBaselineEntries, baselineEntriesLoaded } from './reducers';
import { api } from '../api';

export function initBaselineEntryPage(): ThunkResult<void> {
  return async function (dispatch) {
    dispatch(loadBaselineEntries());
  };
}

function loadBaselineEntries(): ThunkResult<void> {
  return async function (dispatch) {
    dispatch(initLoadingBaselineEntries());
    const baselineEntries = await api.loadBaselineEntries();
    console.log(`[ baseine entries loaded ] ${baselineEntries}`);
    dispatch(baselineEntriesLoaded({ baselineEntries }));
  };
}

export function submitBaselineEntry(payload: BaselineEntryFields): ThunkResult<void> {
  return async function (dispatch) {
    console.log(`[ submit baseline entry ] ${JSON.stringify(payload)}`, payload);
    dispatch(setUpdating({ updating: true }));
    await api.submitBaselineEntry(payload);
    dispatch(loadBaselineEntries());
    dispatch(setUpdating({ updating: false }));
  };
}
