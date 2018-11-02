import Datasource from './datasource';

import LoggingStartPage from './components/LoggingStartPage';
import LoggingQueryField from './components/LoggingQueryField';

export class LoggingConfigCtrl {
  static templateUrl = 'partials/config.html';
}

export {
  Datasource,
  LoggingConfigCtrl as ConfigCtrl,
  LoggingQueryField as ExploreQueryField,
  LoggingStartPage as ExploreStartPage,
};
