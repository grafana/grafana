// Libraries
import React, { PureComponent } from 'react';

// Types
import { QueryEditorProps } from '@grafana/ui/src/types';
import { InputDatasource } from '../datasource';
import { InputQuery } from '../types';

type Props = QueryEditorProps<InputDatasource, InputQuery>;

export class InputQueryEditor extends PureComponent<Props> {
  render() {
    const { datasource } = this.props;
    const { id, name } = datasource;

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

export default InputQueryEditor;
