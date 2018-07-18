import _ from 'lodash';
import kbn from '../../../core/utils/kbn';
import React from 'react';
import ReactDOM from 'react-dom';
import defaults from './defaults';
import { MetricsPanelCtrl } from '../../sdk';
import { convertTSDataToMultistat, convertTableDataToMultistat } from './data_handler';
import { MultiStatPanel } from './components/MultiStat';

class MultiStatCtrl extends MetricsPanelCtrl {
  static templateUrl = 'module.html';

  dataType = 'timeseries';
  series: any[];
  data: any;
  tableColumnOptions: any;
  fontSizes: any[];
  unitFormats: any[];
  valueNameOptions: any[] = defaults.valueNameOptions;
  layoutOptions: any[] = defaults.layoutOptions;
  viewModeOptions: any[] = defaults.viewModeOptions;

  /** @ngInject */
  constructor($scope, $injector) {
    super($scope, $injector);

    _.defaults(this.panel, defaults.panelDefaults);

    this.events.on('data-received', this.onDataReceived.bind(this));
    this.events.on('data-error', this.onDataError.bind(this));
    this.events.on('data-snapshot-load', this.onDataReceived.bind(this));
    this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
  }

  onInitEditMode() {
    this.fontSizes = ['20%', '30%', '50%', '70%', '80%', '100%', '110%', '120%', '150%', '170%', '200%'];
    this.addEditorTab('Options', 'public/app/plugins/panel/multistat/options.html', 2);
    this.addEditorTab('Thresholds', 'public/app/plugins/panel/multistat/thresholds.html', 3);
    this.unitFormats = kbn.getUnitFormats();
  }

  onDataReceived(dataList) {
    if (dataList.length > 0 && dataList[0].type === 'table') {
      this.dataType = 'table';
      this.setTableColumnToSensibleDefault(dataList[0]);
      this.data = convertTableDataToMultistat(dataList, this.panel);
    } else {
      this.dataType = 'timeseries';
      this.data = convertTSDataToMultistat(dataList, this.panel);
      // this.setValues();
    }
    // this.data = data;
    this.render();
  }

  onDataError(err) {
    this.onDataReceived([]);
  }

  setTableColumnToSensibleDefault(tableData) {
    const columnNames = {};

    tableData.columns.forEach((column, columnIndex) => {
      columnNames[columnIndex] = column.text;
    });

    this.tableColumnOptions = columnNames;
    if (_.find(tableData.columns, ['text', this.panel.tableColumn])) {
      return;
    }

    if (tableData.columns.length === 1) {
      this.panel.tableColumn = tableData.columns[0].text;
    } else {
      this.panel.tableColumn = _.find(tableData.columns, col => {
        return col.type !== 'time';
      }).text;
    }
  }

  setValueMapping(data) {}

  setUnitFormat(subItem) {
    this.panel.format = subItem.value;
    this.refresh();
  }

  onThresholdChange = newThresholds => {
    this.panel.thresholds = newThresholds;
    this.render();
  };

  link(scope, elem, attrs, ctrl) {
    const multistatElem = elem.find('.multistat-panel');

    function render() {
      if (!ctrl.data) {
        return;
      }

      const width = multistatElem.width();
      const height = multistatElem.height();
      scope.size = { w: width, h: height };
      renderMultiStatComponent();
    }

    function renderMultiStatComponent() {
      const multistatProps = {
        stats: ctrl.data,
        options: ctrl.panel,
        size: scope.size,
      };
      const multistatReactElem = React.createElement(MultiStatPanel, multistatProps);
      ReactDOM.render(multistatReactElem, multistatElem[0]);
    }

    this.events.on('render', function() {
      render();
      ctrl.renderingCompleted();
    });

    // cleanup when scope is destroyed
    scope.$on('$destroy', () => {
      ReactDOM.unmountComponentAtNode(multistatElem[0]);
    });
  }
}

export { MultiStatCtrl, MultiStatCtrl as PanelCtrl };
