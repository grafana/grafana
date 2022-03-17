import { reduceField } from '@grafana/data';
import { ThunkResult } from 'app/types';
import { getRawIndexData, getFrontendGrafanaSearcher } from '../../service/frontend';
import { fetchResults } from './reducers';

export const loadResults = (query: string): ThunkResult<void> => {
  return async (dispatch) => {
    const data = await getRawIndexData();
    if (!data.dashboard) {
      return;
    }

    const searcher = getFrontendGrafanaSearcher(data);
    const results = await searcher.search(query);

    // HACK avoid redux error!
    results.body.fields.forEach((f) => {
      reduceField({ field: f, reducers: ['min', 'max'] });
    });

    return dispatch(
      fetchResults({
        data: {
          results,
        },
      })
    );
  };
};
