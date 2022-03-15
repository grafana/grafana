import { defaults } from 'lodash';
import React from 'react';
import { Label, QueryField, TypeaheadInput, TypeaheadOutput } from '@grafana/ui';
import { QueryEditorProps } from '@grafana/data';
import { DataSource } from './datasource';
import { defaultQuery, MyDataSourceOptions, FlamegraphQuery } from './types';

type Props = QueryEditorProps<DataSource, FlamegraphQuery, MyDataSourceOptions>;

export const QueryEditor = (props: Props) => {
  const query = defaults({ ...props.query }, defaultQuery);

  const loadAppNames = () => {
    return props.datasource.loadAppNames().then(
      (result) => {
        return result.data.map((value: string) => ({ label: value, value }));
      },
      (response) => {
        throw new Error(response.statusText);
      }
    );
  };

  const onChange = (v: string) => {
    props.onChange({ ...query, name: v });
  };

  const onTypeAhead = async (typeahead: TypeaheadInput): Promise<TypeaheadOutput> => {
    const appNames = await loadAppNames();

    return {
      suggestions: [
        {
          label: 'Applications',
          items: [...appNames],
        },
      ],
    };
  };

  return (
    <div className="gf-form">
      <div style={{ display: 'flex', flexDirection: 'row', marginTop: '10px' }}>
        <Label style={{ marginTop: '8px', marginRight: '10px' }}>Query</Label>

        <div className="gf-form gf-form--grow flex-shrink-1 min-width-30">
          <QueryField
            placeholder="Enter a FlameQL query (run with Shift+Enter)"
            portalOrigin="pyroscope"
            onRunQuery={() => {
              props.onRunQuery();
            }}
            query={query.name}
            onTypeahead={onTypeAhead}
            onChange={onChange}
          />
        </div>
      </div>
    </div>
  );
};
