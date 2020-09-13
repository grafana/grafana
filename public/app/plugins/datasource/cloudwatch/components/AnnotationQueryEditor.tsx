import React, { ChangeEvent } from 'react';
import { LegacyForms } from '@grafana/ui';
const { Switch } = LegacyForms;
import { PanelData } from '@grafana/data';
import { AnnotationQuery } from '../types';
import { CloudWatchDatasource } from '../datasource';
import { QueryField, PanelQueryEditor } from './';

export type Props = {
  query: AnnotationQuery;
  datasource: CloudWatchDatasource;
  onChange: (value: AnnotationQuery) => void;
  data?: PanelData;
};

export function AnnotationQueryEditor(props: React.PropsWithChildren<Props>) {
  const { query, onChange } = props;
  return (
    <>
      <PanelQueryEditor
        {...props}
        onChange={(editorQuery: AnnotationQuery) => onChange({ ...query, ...editorQuery })}
        onRunQuery={() => {}}
        history={[]}
      ></PanelQueryEditor>
      <div className="gf-form-inline">
        <Switch
          label="Enable Prefix Matching"
          labelClass="query-keyword"
          checked={query.prefixMatching}
          onChange={() => onChange({ ...query, prefixMatching: !query.prefixMatching })}
        />

        <div className="gf-form gf-form--grow">
          <QueryField label="Action">
            <input
              disabled={!query.prefixMatching}
              className="gf-form-input width-12"
              value={query.actionPrefix || ''}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                onChange({ ...query, actionPrefix: event.target.value })
              }
            />
          </QueryField>
          <QueryField label="Alarm Name">
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
