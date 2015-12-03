import {transformers} from './transformers';

export class TableModel {
  columns: any[];
  rows: any[];

  constructor() {
    this.columns = [];
    this.rows = [];
  }

  sort(options) {
    if (options.col === null || this.columns.length <= options.col) {
      return;
    }

    this.rows.sort(function(a, b) {
      a = a[options.col];
      b = b[options.col];
      if (a < b) {
        return -1;
      }
      if (a > b) {
        return 1;
      }
      return 0;
    });

    this.columns[options.col].sort = true;

    if (options.desc) {
      this.rows.reverse();
      this.columns[options.col].desc = true;
    }
  }

  static transform(data, panel) {
    var model = new TableModel();

    if (!data || data.length === 0) {
      return model;
    }

    var transformer = transformers[panel.transform];
    if (!transformer) {
      throw {message: 'Transformer ' + panel.transformer + ' not found'};
    }

    transformer.transform(data, panel, model);
    return model;
  }
}
