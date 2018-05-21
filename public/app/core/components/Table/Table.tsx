import _ from 'lodash';
import React from 'react';
import ReactTable from 'react-table';
import { react2AngularDirective } from 'app/core/utils/react2angular';
import templateSrv from 'app/features/templating/template_srv';

export interface IProps {
  data: any;
  height: number;
  pageSize: number;
}

export class Table extends React.Component<IProps, any> {
  constructor(props) {
    super(props);
  }

  render() {
    let rows = [];
    let columns = [];
    if (this.props.data) {
      let columnNames = this.props.data.columns.map(c => {
        return c.text;
      });
      rows = this.props.data.rows.map(row => {
        return _.zipObject(columnNames, row);
      });
      columns = this.props.data.columns.map(c => {
        return {
          Header: c.text,
          accessor: c.text,
          filterable: !!c.filterble,
        };
      });
      console.log(templateSrv);
      console.log(rows);
    }
    let pageSize = this.props.pageSize || 100;
    return (
      <ReactTable
        data={rows}
        columns={columns}
        defaultPageSize={pageSize}
        style={{
          height: this.props.height - 20 + 'px',
        }}
        showPaginationBottom
      />
    );
  }
}

react2AngularDirective('reactTable', Table, ['data', 'height', 'pageSize']);
