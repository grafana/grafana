// Libraries
import React, { PureComponent } from 'react';

// Types
import { QueryEditorProps } from '@grafana/ui/src/types';
import { TableDatasource } from '../datasource';
import { TableQuery } from '../types';

type Props = QueryEditorProps<TableDatasource, TableQuery>;

export class TableQueryEditor extends PureComponent<Props> {
  render() {
    const { datasource } = this.props;
    console.log('DATASOURCE', datasource);

    return (
      <div>
        <div className="gf-form">
          <div className="gf-form-label">Return all fields from the datasource:</div>
        </div>
      </div>
    );
  }
}

// <a href={`datasources/edit/${datasource.id}/`}>{datasource.name}</a>

export default TableQueryEditor;
