import React, { FC, useState } from 'react';

import { DataSourceSettings } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { InlineField, InlineSwitch, Input, LinkButton } from '@grafana/ui';

import { ChangeUIDModal } from './ChangeUIDModal';

export interface Props {
  dataSource: DataSourceSettings;
  onNameChange: (name: string) => void;
  onDefaultChange: (value: boolean) => void;
}

const BasicSettings: FC<Props> = ({ dataSource, onDefaultChange, onNameChange }) => {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="gf-form-group" aria-label="Datasource settings page basic settings">
      <div className="gf-form-inline">
        <div className="max-width-30">
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
              value={dataSource.name}
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
            value={dataSource.isDefault}
            onChange={(event: React.FormEvent<HTMLInputElement>) => {
              onDefaultChange(event.currentTarget.checked);
            }}
          />
        </InlineField>
      </div>
      <div className="gf-form-inline">
        <div className="gf-form max-width-30">
          <InlineField
            label="Identifer (uid)"
            labelWidth={15}
            tooltip="This is the logical id that is used in references to this data sources"
            grow
            disabled
          >
            <Input
              id="settings-uid"
              type="text"
              value={dataSource.uid}
              placeholder="uid"
              onChange={(event) => onNameChange(event.currentTarget.value)}
              suffix={
                !dataSource.readOnly && (
                  <LinkButton fill="text" size="sm" onClick={() => setShowModal(true)}>
                    Change
                  </LinkButton>
                )
              }
            />
          </InlineField>
          {showModal && <ChangeUIDModal dataSource={dataSource} onDismiss={() => setShowModal(false)} />}
        </div>
      </div>
    </div>
  );
};

export default BasicSettings;
