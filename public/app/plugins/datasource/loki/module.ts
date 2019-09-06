import Datasource from './datasource';

import LokiStartPage from './components/LokiStartPage';
import LokiQueryField from './components/LokiQueryField';
import LokiQueryEditor from './components/LokiQueryEditor';
import { LokiAnnotationsQueryCtrl } from './annotations_query_ctrl';

export class LokiConfigCtrl {
  static templateUrl = 'partials/config.html';
}

export {
  Datasource,
  LokiQueryEditor as QueryEditor,
  LokiConfigCtrl as ConfigCtrl,
  LokiQueryField as ExploreQueryField,
  LokiStartPage as ExploreStartPage,
  LokiAnnotationsQueryCtrl as AnnotationsQueryCtrl,
};
