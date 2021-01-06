import { DataSourcePluginOptionsEditorProps, updateDatasourcePluginJsonDataOption } from '@grafana/data';
import { InlineField, Input, Switch } from '@grafana/ui';
import { DataSourcePicker } from 'app/core/components/Select/DataSourcePicker';
import React, { useState } from 'react';
import { PromOptions } from '../types';

interface Props extends DataSourcePluginOptionsEditorProps<PromOptions> {}

export function ExemplarsSettings({ options, onOptionsChange }: Props) {
  const [isInternalLink, setIsInternalLink] = useState(
    Boolean(options.jsonData.exemplarTraceIDDestination?.datasourceUid)
  );

  return (
    <>
      <h3 className="page-heading">Exemplars</h3>

      <InlineField label="Internal link" labelWidth={24}>
        <div style={{ alignSelf: 'center' }}>
          <Switch value={isInternalLink} onChange={ev => setIsInternalLink(ev.currentTarget.checked)} />
        </div>
      </InlineField>

      {isInternalLink ? (
        <InlineField
          label="Data source"
          labelWidth={24}
          tooltip="The data source the exemplar is going to navigate to."
        >
          <DataSourcePicker
            tracing={true}
            current={options.jsonData.exemplarTraceIDDestination?.datasourceUid}
            noDefault={true}
            onChange={ds =>
              updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'exemplarTraceIDDestination', {
                datasourceUid: ds.uid,
                name: options.jsonData.exemplarTraceIDDestination?.name,
                url: undefined,
              })
            }
          />
        </InlineField>
      ) : (
        <InlineField
          label="URL"
          labelWidth={24}
          tooltip="The URL of the trace backend the user would go to see its trace."
        >
          <Input
            placeholder="https://example.com/${value}"
            spellCheck={false}
            width={40}
            value={options.jsonData.exemplarTraceIDDestination?.url}
            onChange={event =>
              updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'exemplarTraceIDDestination', {
                datasourceUid: undefined,
                name: options.jsonData.exemplarTraceIDDestination?.name,
                url: event.currentTarget.value,
              })
            }
          />
        </InlineField>
      )}

      <InlineField
        label="Label name"
        labelWidth={24}
        tooltip="The name of the field in the labels object that should be used to get the traceID."
      >
        <Input
          placeholder="traceID"
          spellCheck={false}
          width={40}
          value={options.jsonData.exemplarTraceIDDestination?.name}
          onChange={event =>
            updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'exemplarTraceIDDestination', {
              datasourceUid: options.jsonData.exemplarTraceIDDestination?.datasourceUid,
              url: options.jsonData.exemplarTraceIDDestination?.url,
              name: event.currentTarget.value,
            })
          }
        />
      </InlineField>
    </>
  );
}
