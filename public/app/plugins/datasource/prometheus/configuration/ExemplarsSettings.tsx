import { DataSourcePluginOptionsEditorProps, updateDatasourcePluginJsonDataOption } from '@grafana/data';
import { InlineField, InlineSwitch, Input } from '@grafana/ui';
import { DataSourcePicker } from 'app/core/components/Select/DataSourcePicker';
import React, { useState } from 'react';
import { PromOptions } from '../types';

interface Props extends DataSourcePluginOptionsEditorProps<PromOptions> {}

export function ExemplarsSettings({ options, onOptionsChange }: Props) {
  const [isInternalLink, setIsInternalLink] = useState(
    Boolean(options.jsonData.exemplarTraceIdDestination?.datasourceUid)
  );

  return (
    <>
      <h3 className="page-heading">Exemplars</h3>

      <InlineField label="Internal link" labelWidth={24}>
        <InlineSwitch value={isInternalLink} onChange={ev => setIsInternalLink(ev.currentTarget.checked)} />
      </InlineField>

      {isInternalLink ? (
        <InlineField
          label="Data source"
          labelWidth={24}
          tooltip="The data source the exemplar is going to navigate to."
        >
          <DataSourcePicker
            tracing={true}
            current={options.jsonData.exemplarTraceIdDestination?.datasourceUid}
            noDefault={true}
            onChange={ds =>
              updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'exemplarTraceIdDestination', {
                datasourceUid: ds.uid,
                name: options.jsonData.exemplarTraceIdDestination?.name,
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
            placeholder="https://example.com/${__value.raw}"
            spellCheck={false}
            width={40}
            value={options.jsonData.exemplarTraceIdDestination?.url}
            onChange={event =>
              updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'exemplarTraceIdDestination', {
                datasourceUid: undefined,
                name: options.jsonData.exemplarTraceIdDestination?.name,
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
          value={options.jsonData.exemplarTraceIdDestination?.name}
          onChange={event =>
            updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'exemplarTraceIdDestination', {
              datasourceUid: options.jsonData.exemplarTraceIdDestination?.datasourceUid,
              url: options.jsonData.exemplarTraceIdDestination?.url,
              name: event.currentTarget.value,
            })
          }
        />
      </InlineField>
    </>
  );
}
