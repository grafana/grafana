import { css } from '@emotion/css';
import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import * as React from 'react';
import { usePrevious } from 'react-use';

import { DataSourceInstanceSettings, VariableSuggestion } from '@grafana/data';
import { DataSourcePicker } from '@grafana/runtime';
import {
  Button,
  DataLinkInput,
  InlineField,
  InlineSwitch,
  InlineFieldRow,
  InlineLabel,
  Input,
  useStyles2,
} from '@grafana/ui';

import { DataLinkConfig } from '../types';

interface Props {
  value: DataLinkConfig;
  onChange: (value: DataLinkConfig) => void;
  onDelete: () => void;
  suggestions: VariableSuggestion[];
  className?: string;
}

export const DataLink = (props: Props) => {
  const { value, onChange, onDelete, suggestions, className } = props;
  const styles = useStyles2(getStyles);
  const [showInternalLink, setShowInternalLink] = useInternalLink(value.datasourceUid);

  const handleChange = (field: keyof typeof value) => (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...value,
      [field]: event.currentTarget.value,
    });
  };

  return (
    <div className={className}>
      <div className={styles.firstRow}>
        <InlineField
          label="Field"
          htmlFor="elasticsearch-datasource-config-field"
          labelWidth={12}
          tooltip={'Can be exact field name or a regex pattern that will match on the field name.'}
        >
          <Input
            type="text"
            id="elasticsearch-datasource-config-field"
            value={value.field}
            onChange={handleChange('field')}
            width={100}
          />
        </InlineField>
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

      <InlineFieldRow>
        <div className={styles.urlField}>
          <InlineLabel htmlFor="elasticsearch-datasource-internal-link" width={12}>
            {showInternalLink ? 'Query' : 'URL'}
          </InlineLabel>
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
        </div>

        <div className={styles.urlDisplayLabelField}>
          <InlineField
            label="URL Label"
            htmlFor="elasticsearch-datasource-url-label"
            labelWidth={14}
            tooltip={'Use to override the button label.'}
          >
            <Input
              type="text"
              id="elasticsearch-datasource-url-label"
              value={value.urlDisplayLabel}
              onChange={handleChange('urlDisplayLabel')}
            />
          </InlineField>
        </div>
      </InlineFieldRow>

      <div className={styles.row}>
        <InlineField label="Internal link" labelWidth={12}>
          <InlineSwitch
            label="Internal link"
            value={showInternalLink || false}
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
        </InlineField>

        {showInternalLink && (
          <DataSourcePicker
            tracing={true}
            // Uid and value should be always set in the db and so in the items.
            onChange={(ds: DataSourceInstanceSettings) => {
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

const getStyles = () => ({
  firstRow: css({
    display: 'flex',
  }),
  nameField: css({
    flex: 2,
  }),
  regexField: css({
    flex: 3,
  }),
  row: css({
    display: 'flex',
    alignItems: 'baseline',
  }),
  urlField: css({
    display: 'flex',
    flex: 1,
  }),
  urlDisplayLabelField: css({
    flex: 1,
  }),
});
