import { css } from '@emotion/css';
import React, { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { usePrevious } from 'react-use';

import { VariableSuggestion } from '@grafana/data';
import { DataSourcePicker } from '@grafana/runtime';
import { Button, LegacyForms, DataLinkInput, stylesFactory } from '@grafana/ui';

import { DataLinkConfig } from '../types';

const { FormField, Switch } = LegacyForms;

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
  urlField: css`
    flex: 1;
  `,
  urlDisplayLabelField: css`
    flex: 1;
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
          onClick={(event) => {
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
              onChange={(newValue) =>
                onChange({
                  ...value,
                  url: newValue,
                })
              }
              suggestions={suggestions}
            />
          }
          className={styles.urlField}
        />
        <FormField
          className={styles.urlDisplayLabelField}
          inputWidth={null}
          labelWidth={7}
          label="URL Label"
          type="text"
          value={value.urlDisplayLabel}
          onChange={handleChange('urlDisplayLabel')}
          tooltip={'Use to override the button label.'}
        />
      </div>

      <div className={styles.row}>
        <Switch
          labelClass={'width-6'}
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
          <DataSourcePicker
            tracing={true}
            // Uid and value should be always set in the db and so in the items.
            onChange={(ds) => {
              onChange({
                ...value,
                datasourceUid: ds.uid,
              });
            }}
            current={value.datasourceUid}
          />
        )}
      </div>
    </div>
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
