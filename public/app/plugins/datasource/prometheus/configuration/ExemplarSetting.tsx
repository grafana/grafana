import { css } from '@emotion/css';
import React, { useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { DataSourcePicker } from '@grafana/runtime';
import { Button, InlineField, InlineSwitch, Input } from '@grafana/ui';

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
          <InlineSwitch
            value={isInternalLink}
            aria-label={selectors.components.DataSource.Prometheus.configPage.internalLinkSwitch}
            onChange={(ev) => setIsInternalLink(ev.currentTarget.checked)}
          />
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
            width={40}
            onChange={(ds) =>
              onChange({
                ...value,
                datasourceUid: ds.uid,
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
                ...value,
                datasourceUid: undefined,
                url: event.currentTarget.value,
              })
            }
          />
        </InlineField>
      )}

      <InlineField
        label="URL Label"
        labelWidth={24}
        tooltip="Use to override the button label on the exemplar traceID field."
      >
        <Input
          placeholder="Go to example.com"
          spellCheck={false}
          width={40}
          value={value.urlDisplayLabel}
          onChange={(event) =>
            onChange({
              ...value,
              urlDisplayLabel: event.currentTarget.value,
            })
          }
        />
      </InlineField>
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
