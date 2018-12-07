import Datasource from './datasource';

import LokiStartPage from './components/LokiStartPage';
import LokiQueryField from './components/LokiQueryField';

export class LokiConfigCtrl {
  static templateUrl = 'partials/config.html';
}

export {
  Datasource,
  LokiConfigCtrl as ConfigCtrl,
  LokiQueryField as ExploreQueryField,
  LokiStartPage as ExploreStartPage,
};
