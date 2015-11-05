import {transformers} from './transformers';

export class TableModel {
  columns: any[];
  rows: any[];

  constructor() {
    this.columns = [];
    this.rows = [];
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
