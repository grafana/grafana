import React, { useEffect, useState } from 'react';
import { css } from 'emotion';
import { Button, DataLinkInput, stylesFactory, LegacyForms } from '@grafana/ui';
const { Switch, FormField } = LegacyForms;
import { VariableSuggestion } from '@grafana/data';
import { DataSourceSelectItem } from '@grafana/data';

import { DerivedFieldConfig } from '../types';
import DataSourcePicker from 'app/core/components/Select/DataSourcePicker';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { usePrevious } from 'react-use';

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
  const [showInternalLink, setShowInternalLink] = useState(!!value.datasourceUid);
  const previousUid = usePrevious(value.datasourceUid);

  // Force internal link visibility change if uid changed outside of this component.
  useEffect(() => {
    if (!previousUid && value.datasourceUid && !showInternalLink) {
      setShowInternalLink(true);
    }
    if (previousUid && !value.datasourceUid && showInternalLink) {
      setShowInternalLink(false);
    }
  }, [previousUid, value.datasourceUid, showInternalLink]);

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
          icon="times"
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
        label={showInternalLink ? 'Query' : 'URL'}
        labelWidth={5}
        inputEl={
          <DataLinkInput
            placeholder={showInternalLink ? '${__value.raw}' : 'http://example.com/${__value.raw}'}
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

      <div className={styles.row}>
        <Switch
          label="Internal link"
          checked={showInternalLink}
          onChange={() => {
            if (showInternalLink) {
              onChange({
                ...value,
                datasourceUid: undefined,
              });
            }
            setShowInternalLink(!showInternalLink);
          }}
        />

        {showInternalLink && (
          <DataSourceSection
            onChange={datasourceUid => {
              onChange({
                ...value,
                datasourceUid,
              });
            }}
            datasourceUid={value.datasourceUid}
          />
        )}
      </div>
    </div>
  );
};

type DataSourceSectionProps = {
  datasourceUid?: string;
  onChange: (uid: string) => void;
};

const DataSourceSection = (props: DataSourceSectionProps) => {
  const { datasourceUid, onChange } = props;
  const datasources: DataSourceSelectItem[] = getDatasourceSrv()
    .getExternal()
    // At this moment only Jaeger and Zipkin datasource is supported as the link target.
    .filter(ds => ds.meta.tracing)
    .map(
      ds =>
        ({
          value: ds.uid,
          name: ds.name,
          meta: ds.meta,
        } as DataSourceSelectItem)
    );

  let selectedDatasource = datasourceUid && datasources.find(d => d.value === datasourceUid);
  return (
    <DataSourcePicker
      // Uid and value should be always set in the db and so in the items.
      onChange={ds => onChange(ds.value!)}
      datasources={datasources}
      current={selectedDatasource || undefined}
    />
  );
};
