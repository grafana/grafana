import React, { FC } from 'react';
import { InlineFormLabel, LegacyForms } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';

const { Input, Switch } = LegacyForms;

export interface Props {
  dataSourceName: string;
  isDefault: boolean;
  onNameChange: (name: string) => void;
  onDefaultChange: (value: boolean) => void;
}

const BasicSettings: FC<Props> = ({ dataSourceName, isDefault, onDefaultChange, onNameChange }) => {
  return (
    <div className="gf-form-group" aria-label="Datasource settings page basic settings">
      <div className="gf-form-inline">
        <div className="gf-form max-width-30" style={{ marginRight: '3px' }}>
          <InlineFormLabel
            tooltip={
              'The name is used when you select the data source in panels. The Default data source is ' +
              'preselected in new panels.'
            }
          >
            Name
          </InlineFormLabel>
          <Input
            className="gf-form-input max-width-23"
            type="text"
            value={dataSourceName}
            placeholder="Name"
            onChange={event => onNameChange(event.target.value)}
            required
            aria-label={selectors.pages.DataSource.name}
          />
        </div>
        <Switch
          label="Default"
          checked={isDefault}
          onChange={event => {
            // @ts-ignore
            onDefaultChange(event.target.checked);
          }}
        />
      </div>
    </div>
  );
};

export default BasicSettings;
