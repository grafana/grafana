import Datasource from './datasource';

import LokiCheatSheet from './components/LokiCheatSheet';
import LokiQueryField from './components/LokiQueryField';
import LokiQueryEditor from './components/LokiQueryEditor';
import { LokiAnnotationsQueryCtrl } from './LokiAnnotationsQueryCtrl';

export class LokiConfigCtrl {
  static templateUrl = 'partials/config.html';
}

export {
  Datasource,
  LokiQueryEditor as QueryEditor,
  LokiConfigCtrl as ConfigCtrl,
  LokiQueryField as ExploreQueryField,
  LokiCheatSheet as ExploreStartPage,
  LokiAnnotationsQueryCtrl as AnnotationsQueryCtrl,
};
