import { dispatch } from 'app/store/store';

import { changeCorrelationEditorDetails } from '../state/main';
import { runQueries } from '../state/query';

export function startCorrelation(exploreId: string) {
  dispatch(changeCorrelationEditorDetails({ editorMode: true }));
  dispatch(runQueries({ exploreId }));
}
