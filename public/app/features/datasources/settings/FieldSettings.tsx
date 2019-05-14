import React, { PureComponent } from 'react';
import _ from 'lodash';

import { Props } from './PluginSettings';
import { DefaultFieldInfo, DeleteButton } from '@grafana/ui';

export class FieldSettings extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);
  }

  onDelete = (info: DefaultFieldInfo) => {
    console.log('TODO, delete it');
  };

  render() {
    const { plugin } = this.props;

    if (!plugin) {
      return null;
    }

    const finfo: DefaultFieldInfo[] = [
      { name: 'field1', field: {} },
      { name: 'field2', field: {} },
      { name: 'field3', field: {} },
    ];

    return (
      <div>
        <table className="filter-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Unit</th>
              <th>Decimals</th>
              <th>Min</th>
              <th>Max</th>
              <th>Mapping</th>
              <th>Thresholds</th>
              <th style={{ width: '34px' }} />
            </tr>
          </thead>
          <tbody>
            {finfo.map(info => {
              return (
                <tr key={info.name}>
                  <td>{info.name}</td>
                  <td>Unit</td>
                  <td>
                    <input
                      type="number"
                      className="gf-form-input width-4"
                      placeholder="auto"
                      min={0}
                      max={25}
                      step={1}
                    />
                  </td>
                  <td>
                    <input type="number" className="gf-form-input width-4" step={0.001} />
                  </td>
                  <td>
                    <input type="number" className="gf-form-input width-4" step={0.001} />
                  </td>
                  <td>Mapping</td>
                  <td>Thresholds</td>
                  <td>
                    <DeleteButton onConfirm={() => this.onDelete(info)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
}

export default FieldSettings;
