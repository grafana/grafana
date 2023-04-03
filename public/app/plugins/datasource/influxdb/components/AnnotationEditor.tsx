import React, { useState } from 'react';

import { QueryEditorProps } from '@grafana/data';
import { InlineFormLabel, Input } from '@grafana/ui';

import { InfluxQuery, InfluxOptions } from '../types';

import InfluxDatasource from './../datasource';

export const AnnotationEditor = (props: QueryEditorProps<InfluxDatasource, InfluxQuery, InfluxOptions>) => {
  const { query, onChange } = props;
  const [eventQuery, setEventQuery] = useState<string>(query.expr ?? '');

  const [textColumn, setTextColumn] = useState<string>(query.textColumn ?? '');
  const [tagsColumn, setTagsColumn] = useState<string>(query.tagsColumn ?? '');
  const [timeEndColumn, setTimeEndColumn] = useState<string>(query?.timeEndColumn ?? '');
  const [titleColumn] = useState<string>(query?.titleColumn ?? '');
  const updateValue = <K extends keyof InfluxQuery, V extends InfluxQuery[K]>(key: K, val: V) => {
    onChange({
      ...query,
      [key]: val,
      fromAnnotations: true,
      textEditor: true,
    });
  };
  return (
    <div className="gf-form-group">
      <div className="gf-form">
        <InlineFormLabel width={12}>InfluxQL Query</InlineFormLabel>
        <Input
          value={eventQuery}
          onChange={(e) => setEventQuery(e.currentTarget.value ?? '')}
          onBlur={() => updateValue('expr', eventQuery)}
          placeholder="select text from events where $timeFilter limit 1000"
        />
      </div>
      <InlineFormLabel
        width={12}
        tooltip={
          <div>
            If your influxdb query returns more than one field you need to specify the column names below. An annotation
            event is composed of a title, tags, and an additional text field. Optionally you can map the timeEnd column
            for region annotation usage.
          </div>
        }
      >
        Field mappings
      </InlineFormLabel>
      <div className="gf-form-group">
        <div className="gf-form-inline">
          <div className="gf-form">
            <InlineFormLabel width={12}>Text</InlineFormLabel>
            <Input
              value={textColumn}
              onChange={(e) => setTextColumn(e.currentTarget.value ?? '')}
              onBlur={() => updateValue('textColumn', textColumn)}
            />
          </div>
          <div className="gf-form">
            <InlineFormLabel width={12}>Tags</InlineFormLabel>
            <Input
              value={tagsColumn}
              onChange={(e) => setTagsColumn(e.currentTarget.value ?? '')}
              onBlur={() => updateValue('tagsColumn', tagsColumn)}
            />
          </div>
          <div className="gf-form">
            <InlineFormLabel width={12}>TimeEnd</InlineFormLabel>
            <Input
              value={timeEndColumn}
              onChange={(e) => setTimeEndColumn(e.currentTarget.value ?? '')}
              onBlur={() => updateValue('timeEndColumn', timeEndColumn)}
            />
          </div>
          <div className="gf-form ng-hide">
            <InlineFormLabel width={12}>Title</InlineFormLabel>
            <Input defaultValue={titleColumn} />
          </div>
        </div>
      </div>
    </div>
  );
};
