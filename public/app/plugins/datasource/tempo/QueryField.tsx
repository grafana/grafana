import React from 'react';
import { TempoDatasource, TempoQuery } from './datasource';

import { ExploreQueryFieldProps } from '@grafana/data';
import { LegacyForms } from '@grafana/ui';

type Props = ExploreQueryFieldProps<TempoDatasource, TempoQuery>;
export class TempoQueryField extends React.PureComponent<Props> {
  render() {
    const { query, onChange } = this.props;

    return (
      <LegacyForms.FormField
        label="Trace ID"
        labelWidth={4}
        inputEl={
          <div className="slate-query-field__wrapper">
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
        }
      />
    );
  }
}
