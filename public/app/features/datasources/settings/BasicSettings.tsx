import React, { FC } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { InlineField, InlineFieldRow, InlineSwitch, Input, LinkButton } from '@grafana/ui';

export interface Props {
  dataSourceName: string;
  uid: string;
  isDefault: boolean;
  onNameChange: (name: string) => void;
  onDefaultChange: (value: boolean) => void;
}

const BasicSettings: FC<Props> = ({ dataSourceName, uid, isDefault, onDefaultChange, onNameChange }) => {
  return (
    <div className="gf-form-group" aria-label="Datasource settings page basic settings">
      <div className="gf-form-inline">
        <div className="gf-form max-width-30">
          <InlineField
            label="Name"
            tooltip="The name is used when you select the data source in panels. The default data source is
              'preselected in new panels."
            labelWidth={15}
            grow
          >
            <Input
              id="basic-settings-name"
              type="text"
              value={dataSourceName}
              placeholder="Name"
              onChange={(event) => onNameChange(event.currentTarget.value)}
              required
              aria-label={selectors.pages.DataSource.name}
            />
          </InlineField>
        </div>

        <InlineField label="Default" labelWidth={8}>
          <InlineSwitch
            id="basic-settings-default"
            value={isDefault}
            onChange={(event: React.FormEvent<HTMLInputElement>) => {
              onDefaultChange(event.currentTarget.checked);
            }}
          />
        </InlineField>
      </div>
      <InlineFieldRow>
        <InlineField
          label="Identifer (uid)"
          labelWidth={15}
          tooltip="This is the logical id Grafana will use to refer to this data source in dashboard and query models"
          grow
          disabled
        >
          <Input
            id="settings-uid"
            type="text"
            value={uid}
            width={20}
            placeholder="uid"
            onChange={(event) => onNameChange(event.currentTarget.value)}
            suffix={
              <LinkButton fill="text" size="sm">
                Change
              </LinkButton>
            }
          />
        </InlineField>
      </InlineFieldRow>
    </div>
  );
};

export default BasicSettings;
