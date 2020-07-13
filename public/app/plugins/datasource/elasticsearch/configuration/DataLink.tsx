import React, { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { css } from 'emotion';
import { DataSourceSelectItem, VariableSuggestion } from '@grafana/data';
import { Button, LegacyForms, DataLinkInput, stylesFactory } from '@grafana/ui';
const { FormField, Switch } = LegacyForms;
import { DataLinkConfig } from '../types';
import { usePrevious } from 'react-use';
import { getDatasourceSrv } from '../../../../features/plugins/datasource_srv';
import DataSourcePicker from '../../../../core/components/Select/DataSourcePicker';

const getStyles = stylesFactory(() => ({
  firstRow: css`
    display: flex;
  `,
  nameField: css`
    flex: 2;
  `,
  regexField: css`
    flex: 3;
  `,
  row: css`
    display: flex;
    align-items: baseline;
  `,
}));

type Props = {
  value: DataLinkConfig;
  onChange: (value: DataLinkConfig) => void;
  onDelete: () => void;
  suggestions: VariableSuggestion[];
  className?: string;
};
export const DataLink = (props: Props) => {
  const { value, onChange, onDelete, suggestions, className } = props;
  const styles = getStyles();
  const [showInternalLink, setShowInternalLink] = useInternalLink(value.datasourceUid);

  const handleChange = (field: keyof typeof value) => (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...value,
      [field]: event.currentTarget.value,
    });
  };

  return (
    <div className={className}>
      <div className={styles.firstRow + ' gf-form'}>
        <FormField
          className={styles.nameField}
          labelWidth={6}
          // A bit of a hack to prevent using default value for the width from FormField
          inputWidth={null}
          label="Field"
          type="text"
          value={value.field}
          tooltip={'Can be exact field name or a regex pattern that will match on the field name.'}
          onChange={handleChange('field')}
        />
        <Button
          variant={'destructive'}
          title="Remove field"
          icon="times"
          onClick={event => {
            event.preventDefault();
            onDelete();
          }}
        />
      </div>
      <div className="gf-form">
        <FormField
          label={showInternalLink ? 'Query' : 'URL'}
          labelWidth={6}
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
      </div>

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

function useInternalLink(datasourceUid?: string): [boolean, Dispatch<SetStateAction<boolean>>] {
  const [showInternalLink, setShowInternalLink] = useState<boolean>(!!datasourceUid);
  const previousUid = usePrevious(datasourceUid);

  // Force internal link visibility change if uid changed outside of this component.
  useEffect(() => {
    if (!previousUid && datasourceUid && !showInternalLink) {
      setShowInternalLink(true);
    }
    if (previousUid && !datasourceUid && showInternalLink) {
      setShowInternalLink(false);
    }
  }, [previousUid, datasourceUid, showInternalLink]);

  return [showInternalLink, setShowInternalLink];
}
