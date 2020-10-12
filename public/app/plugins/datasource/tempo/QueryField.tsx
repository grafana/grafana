import React from 'react';
import { TempoDatasource, TempoQuery } from './datasource';

import { ExploreQueryFieldProps } from '@grafana/data';

type Props = ExploreQueryFieldProps<TempoDatasource, TempoQuery>;
export class TempoQueryField extends React.PureComponent<Props> {
  render() {
    const { query, onChange } = this.props;

    return (
      <div className="gf-form-inline gf-form-inline--nowrap">
        <div className="gf-form gf-form--grow flex-shrink-1">
          <div className={'slate-query-field__wrapper'}>
            <div className="slate-query-field">
              <input
                style={{ width: '100%' }}
                value={query.query || ''}
                onChange={e =>
                  onChange({
                    ...query,
                    query: e.currentTarget.value,
                  })
                }
              />
            </div>
          </div>
        </div>
      </div>
    );
  }
}
