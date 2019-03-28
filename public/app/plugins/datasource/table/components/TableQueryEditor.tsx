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

    // Not sure why using id and name directly is not working
    const id = (datasource as any).id;
    const name = (datasource as any).name;

    return (
      <div>
        <div className="gf-form">
          <div className="btn btn-link">
            <a href={`datasources/edit/${id}/`}>
              All data from: {name} &nbsp;&nbsp;
              <i className="fa fa-pencil-square-o" />
            </a>
          </div>
        </div>
      </div>
    );
  }
}

export default TableQueryEditor;
