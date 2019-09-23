import { PrometheusDatasource } from './datasource';
import { PromQueryEditor } from './components/PromQueryEditor';
import { PrometheusConfigCtrl } from './config_ctrl';

import PromCheatSheet from './components/PromCheatSheet';
import PromQueryField from './components/PromQueryField';

class PrometheusAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
}

export {
  PrometheusDatasource as Datasource,
  PromQueryEditor as QueryEditor,
  PrometheusConfigCtrl as ConfigCtrl,
  PrometheusAnnotationsQueryCtrl as AnnotationsQueryCtrl,
  PromQueryField as ExploreQueryField,
  PromCheatSheet as ExploreStartPage,
};
