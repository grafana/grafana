import React, { useState } from 'react';
import { css } from 'emotion';
import { Button, FormField, DataLinkInput, stylesFactory, Switch } from '@grafana/ui';
import { VariableSuggestion } from '@grafana/data';
import { DataSourceSelectItem } from '@grafana/data';

import { DerivedFieldConfig } from '../types';
import DataSourcePicker from 'app/core/components/Select/DataSourcePicker';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { config } from 'app/core/config';

const getStyles = stylesFactory(() => ({
  row: css`
    display: flex;
    align-items: baseline;
  `,
  nameField: css`
    flex: 2;
  `,
  regexField: css`
    flex: 3;
  `,
}));

type Props = {
  value: DerivedFieldConfig;
  onChange: (value: DerivedFieldConfig) => void;
  onDelete: () => void;
  suggestions: VariableSuggestion[];
  className?: string;
};
export const DerivedField = (props: Props) => {
  const { value, onChange, onDelete, suggestions, className } = props;
  const styles = getStyles();
  const [hasIntenalLink, setHasInternalLink] = useState(!!value.datasourceName);

  const handleChange = (field: keyof typeof value) => (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...value,
      [field]: event.currentTarget.value,
    });
  };

  return (
    <div className={className}>
      <div className={styles.row}>
        <FormField
          className={styles.nameField}
          labelWidth={5}
          // A bit of a hack to prevent using default value for the width from FormField
          inputWidth={null}
          label="Name"
          type="text"
          value={value.name}
          onChange={handleChange('name')}
        />
        <FormField
          className={styles.regexField}
          inputWidth={null}
          label="Regex"
          type="text"
          value={value.matcherRegex}
          onChange={handleChange('matcherRegex')}
          tooltip={
            'Use to parse and capture some part of the log message. You can use the captured groups in the template.'
          }
        />
        <Button
          variant="destructive"
          title="Remove field"
          icon={'fa fa-times'}
          onClick={event => {
            event.preventDefault();
            onDelete();
          }}
          className={css`
            margin-left: 8px;
          `}
        />
      </div>

      <FormField
        label="URL"
        labelWidth={5}
        inputEl={
          <DataLinkInput
            placeholder={'http://example.com/${__value.raw}'}
            value={value.url || ''}
            onChange={newValue =>
              onChange({
                ...value,
                url: newValue,
              })
            }
            suggestions={suggestions}
          />
        }
        className={css`
          width: 100%;
        `}
      />

      {config.featureToggles.tracingIntegration && (
        <div className={styles.row}>
          <Switch
            label="Internal link"
            checked={hasIntenalLink}
            onChange={() => {
              if (hasIntenalLink) {
                onChange({
                  ...value,
                  datasourceName: undefined,
                });
              }
              setHasInternalLink(!hasIntenalLink);
            }}
          />

          {hasIntenalLink && (
            <DataSourceSection
              onChange={datasourceName => {
                onChange({
                  ...value,
                  datasourceName,
                });
              }}
              datasourceName={value.datasourceName}
            />
          )}
        </div>
      )}
    </div>
  );
};

type DataSourceSectionProps = {
  datasourceName?: string;
  onChange: (name: string) => void;
};
const DataSourceSection = (props: DataSourceSectionProps) => {
  const { datasourceName, onChange } = props;
  const datasources: DataSourceSelectItem[] = getDatasourceSrv()
    .getExternal()
    .map(
      (ds: any) =>
        ({
          value: ds.name,
          name: ds.name,
          meta: ds.meta,
        } as DataSourceSelectItem)
    );
  const selectedDatasource = datasourceName && datasources.find(d => d.name === datasourceName);
  return (
    <DataSourcePicker
      onChange={newValue => {
        onChange(newValue.name);
      }}
      datasources={datasources}
      current={selectedDatasource}
    />
  );
};
