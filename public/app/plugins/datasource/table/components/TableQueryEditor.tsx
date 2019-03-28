// Libraries
import React, { PureComponent } from 'react';

// Types
import { QueryEditorProps } from '@grafana/ui/src/types';
import { TableDatasource } from '../datasource';
import { TableQuery } from '../types';

type Props = QueryEditorProps<TableDatasource, TableQuery>;

export class TableQueryEditor extends PureComponent<Props> {
  render() {
    return (
      <div>
        <div className="gf-form">
          <div className="gf-form-label">Return all fields saved in the datasource</div>
        </div>
      </div>
    );
  }
}

export default TableQueryEditor;
