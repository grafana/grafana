import { SeriesData } from '@grafana/ui';

// Loads the angular wrapping directive
import './CSVInputWrapper';

export class TableConfigCtrl {
  static templateUrl = 'legacy/config.html';

  current: any; // the Current Configuration (set by the plugin infra)

  /** @ngInject */
  constructor($scope: any, $injector: any) {
    console.log('TableConfigCtrl Init', this);
  }

  onParsed = (data: SeriesData[]) => {
    this.current.jsonData.data = data;
  };
}

export default TableConfigCtrl;
