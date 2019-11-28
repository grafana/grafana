import React, { PureComponent, ChangeEvent } from 'react';
import { PanelData } from '@grafana/data';
import { Switch } from '@grafana/ui';
import { CloudWatchQuery, AnnotationQuery } from '../types';
import { QueryField } from './';
import CloudWatchDatasource from '../datasource';
import { QueryFieldsEditor } from './QueryFieldsEditor';

export type AnnotationQueryEditorProps = {
  datasource: CloudWatchDatasource;
  query: AnnotationQuery;
  onChange: (value: AnnotationQuery) => void;
  data?: PanelData;
};

export class AnnotationQueryEditor extends PureComponent<AnnotationQueryEditorProps> {
  componentWillMount() {
    const { query } = this.props;

    if (!query.hasOwnProperty('prefixMatching')) {
      query.prefixMatching = false;
    }

    if (!query.actionPrefix) {
      query.actionPrefix = '';
    }

    if (!query.alarmNamePrefix) {
      query.alarmNamePrefix = '';
    }
  }

  render() {
    const { query, onChange } = this.props;
    return (
      <>
        <QueryFieldsEditor
          {...this.props}
          onChange={(editorQuery: CloudWatchQuery) => onChange({ ...query, ...editorQuery })}
          hideWilcard
          onRunQuery={() => {}}
        ></QueryFieldsEditor>
        <div className="gf-form-inline">
          <Switch
            label="Enable Prefix Matching"
            labelClass="query-keyword"
            checked={query.prefixMatching}
            onChange={() => onChange({ ...query, prefixMatching: !query.prefixMatching })}
          />

          <div className="gf-form gf-form--grow">
            <QueryField className="query-keyword" label="Action">
              <input
                disabled={!query.prefixMatching}
                className="gf-form-input width-12"
                value={query.actionPrefix || ''}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  onChange({ ...query, actionPrefix: event.target.value })
                }
              />
            </QueryField>
            <QueryField className="query-keyword" label="Alarm Name">
              <input
                disabled={!query.prefixMatching}
                className="gf-form-input width-12"
                value={query.alarmNamePrefix || ''}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  onChange({ ...query, alarmNamePrefix: event.target.value })
                }
              />
            </QueryField>
            <div className="gf-form gf-form--grow">
              <div className="gf-form-label gf-form-label--grow" />
            </div>
          </div>
        </div>
      </>
    );
  }
}
