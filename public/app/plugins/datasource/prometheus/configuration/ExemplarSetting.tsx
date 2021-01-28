import { Button, InlineField, InlineSwitch, Input } from '@grafana/ui';
import { DataSourcePicker } from 'app/core/components/Select/DataSourcePicker';
import { css } from 'emotion';
import React, { useState } from 'react';
import { ExemplarTraceIdDestination } from '../types';

type Props = {
  value: ExemplarTraceIdDestination;
  onChange: (value: ExemplarTraceIdDestination) => void;
  onDelete: () => void;
};

export default function ExemplarSetting({ value, onChange, onDelete }: Props) {
  const [isInternalLink, setIsInternalLink] = useState(Boolean(value.datasourceUid));

  return (
    <div className="gf-form-group">
      <InlineField label="Internal link" labelWidth={24}>
        <>
          <InlineSwitch value={isInternalLink} onChange={(ev) => setIsInternalLink(ev.currentTarget.checked)} />
          <Button
            variant="destructive"
            title="Remove link"
            icon="times"
            onClick={(event) => {
              event.preventDefault();
              onDelete();
            }}
            className={css`
              margin-left: 8px;
            `}
          />
        </>
      </InlineField>

      {isInternalLink ? (
        <InlineField
          label="Data source"
          labelWidth={24}
          tooltip="The data source the exemplar is going to navigate to."
        >
          <DataSourcePicker
            tracing={true}
            current={value.datasourceUid}
            noDefault={true}
            onChange={(ds) =>
              onChange({
                datasourceUid: ds.uid,
                name: value.name,
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
            value={value.url}
            onChange={(event) =>
              onChange({
                datasourceUid: undefined,
                name: value.name,
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
          value={value.name}
          onChange={(event) =>
            onChange({
              ...value,
              name: event.currentTarget.value,
            })
          }
        />
      </InlineField>
    </div>
  );
}
