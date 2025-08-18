import { UrlQueryMap, getTimeZone, getDefaultTimeRange, dateMath } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { updateNavIndex } from 'app/core/actions';
import { backendSrv } from 'app/core/services/backend_srv';
import { buildNavModel } from 'app/features/folders/state/navModel';
import { store } from 'app/store/store';

export async function updateNavModel(folderUid: string) {
  try {
    const folder = await backendSrv.getFolderByUid(folderUid);
    store.dispatch(updateNavIndex(buildNavModel(folder)));
  } catch (err) {
    console.warn('Error fetching parent folder', folderUid, 'for dashboard', err);
  }
}

/**
 * Processes query parameters for dashboard loading, normalizing time range and filtering allowed parameters
 */
export function processQueryParamsForDashboardLoad(): UrlQueryMap {
  const queryParams = locationService.getSearch();
  const queryParamsObject = locationService.getSearchObject();

  queryParamsObject.timezone = queryParams.get('timezone') ?? undefined;
  const now = Date.now();
  const timeZone = getTimeZone({
    timeZone: queryParams.get('timezone') ?? undefined,
  });
  const defaultTimeRange = getDefaultTimeRange();

  const fromQP = queryParams.get('from');
  const toQP = queryParams.get('to');

  const to = toQP
    ? dateMath.toDateTime(toQP, {
        roundUp: true,
        timezone: timeZone,
        now: now,
      })
    : undefined;

  const from = fromQP
    ? dateMath.toDateTime(fromQP, {
        roundUp: false,
        timezone: timeZone,
        now: now,
      })
    : undefined;

  queryParamsObject.from = from?.toISOString() ?? defaultTimeRange.from.toISOString();
  queryParamsObject.to = to?.toISOString() ?? defaultTimeRange.to.toISOString();

  // Remove all properties that are not from, to, scopes, version or start with var-
  Object.keys(queryParamsObject).forEach((key) => {
    if (key !== 'from' && key !== 'to' && key !== 'scopes' && key !== 'version' && !key.startsWith('var-')) {
      delete queryParamsObject[key];
    }
  });

  return queryParamsObject;
}
