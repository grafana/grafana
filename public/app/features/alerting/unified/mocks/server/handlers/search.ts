import { HttpResponse, http } from 'msw';

import { grafanaRulerNamespace } from 'app/features/alerting/unified/mocks/grafanaRulerApi';
import { DashboardSearchItemType } from 'app/features/search/types';

export const FOLDER_TITLE_HAPPY_PATH = 'Folder A';

// TODO: Generalise/scaffold out default response for search
// to be more multi purpose
const defaultSearchResponse = [
  {
    title: FOLDER_TITLE_HAPPY_PATH,
    uid: grafanaRulerNamespace.uid,
    id: 1,
    type: DashboardSearchItemType.DashFolder,
  },
  {
    title: 'Folder B',
    id: 2,
  },
  {
    title: 'Folder / with slash',
    id: 2,
    uid: 'b',
    type: DashboardSearchItemType.DashFolder,
  },
];

export const searchHandler = (response = defaultSearchResponse) =>
  http.get(`/api/search`, () => HttpResponse.json(response));

const handlers = [searchHandler()];

export default handlers;
