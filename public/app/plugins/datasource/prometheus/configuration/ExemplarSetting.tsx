import React, { useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { DataSourcePicker } from '@grafana/runtime';
import { Button, InlineField, Input, Switch, useTheme2 } from '@grafana/ui';

import { ExemplarTraceIdDestination } from '../types';

import { docsTip, overhaulStyles, PROM_CONFIG_LABEL_WIDTH } from './ConfigEditor';

type Props = {
  value: ExemplarTraceIdDestination;
  onChange: (value: ExemplarTraceIdDestination) => void;
  onDelete: () => void;
  disabled?: boolean;
};

export default function ExemplarSetting({ value, onChange, onDelete, disabled }: Props) {
  const [isInternalLink, setIsInternalLink] = useState(Boolean(value.datasourceUid));

  const theme = useTheme2();
  const styles = overhaulStyles(theme);

  return (
    <div className="gf-form-group">
      <InlineField
        label="Internal link"
        labelWidth={PROM_CONFIG_LABEL_WIDTH}
        disabled={disabled}
        tooltip={
          <>
            Enable this option if you have an internal link. When enabled, this reveals the data source selector. Select
            the backend tracing data store for your exemplar data. {docsTip()}
          </>
        }
        interactive={true}
        className={styles.switchField}
      >
        <>
          <Switch
            value={isInternalLink}
            aria-label={selectors.components.DataSource.Prometheus.configPage.internalLinkSwitch}
            onChange={(ev) => setIsInternalLink(ev.currentTarget.checked)}
          />
        </>
      </InlineField>

      {isInternalLink ? (
        <InlineField
          label="Data source"
          labelWidth={PROM_CONFIG_LABEL_WIDTH}
          tooltip={<>The data source the exemplar is going to navigate to. {docsTip()}</>}
          disabled={disabled}
          interactive={true}
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
          labelWidth={PROM_CONFIG_LABEL_WIDTH}
          tooltip={<>The URL of the trace backend the user would go to see its trace. {docsTip()}</>}
          disabled={disabled}
          interactive={true}
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
        labelWidth={PROM_CONFIG_LABEL_WIDTH}
        tooltip={<>Use to override the button label on the exemplar traceID field. {docsTip()}</>}
        disabled={disabled}
        interactive={true}
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
        labelWidth={PROM_CONFIG_LABEL_WIDTH}
        tooltip={<>The name of the field in the labels object that should be used to get the traceID. {docsTip()}</>}
        disabled={disabled}
        interactive={true}
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
      {!disabled && (
        <InlineField label="Remove exemplar link" labelWidth={PROM_CONFIG_LABEL_WIDTH} disabled={disabled}>
          <Button
            variant="destructive"
            title="Remove exemplar link"
            icon="times"
            onClick={(event) => {
              event.preventDefault();
              onDelete();
            }}
          />
        </InlineField>
      )}
    </div>
  );
}
