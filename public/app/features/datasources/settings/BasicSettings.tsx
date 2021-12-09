import React, { FC, useState } from 'react';
import { Button, InlineFormLabel, LegacyForms, Modal } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import { DataSourceSettings, LibraryCredential } from '@grafana/data';

const { Input, Switch } = LegacyForms;

export interface Props {
  dataSourceName: string;
  isDefault: boolean;
  dataSource: DataSourceSettings;
  onNameChange: (name: string) => void;
  onDefaultChange: (value: boolean) => void;
  libraryCredentials: LibraryCredential[];
  updateDataSource: any;
}

const BasicSettings: FC<Props> = ({
  dataSource,
  dataSourceName,
  isDefault,
  libraryCredentials,
  onDefaultChange,
  onNameChange,
  updateDataSource,
}) => {
  const [showLibraryCredentialsPicker, setShowLibararyCredentialsPicker] = useState(false);
  console.log(libraryCredentials);
  return (
    <div className="gf-form-group" aria-label="Datasource settings page basic settings">
      <div className="gf-form-inline">
        <div className="gf-form max-width-30" style={{ marginRight: '3px' }}>
          <InlineFormLabel
            tooltip={
              'The name is used when you select the data source in panels. The default data source is ' +
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
            onChange={(event) => onNameChange(event.target.value)}
            required
            aria-label={selectors.pages.DataSource.name}
          />
        </div>
        <Switch
          label="Default"
          checked={isDefault}
          onChange={(event) => {
            // @ts-ignore
            onDefaultChange(event.target.checked);
          }}
        />
        {!dataSource.libraryCredential && (
          <Button type="button" variant="secondary" icon="link" onClick={() => setShowLibararyCredentialsPicker(true)}>
            Use library credential
          </Button>
        )}
        {showLibraryCredentialsPicker && (
          <Modal
            title="Select library credential"
            icon="arrow-random"
            onDismiss={() => setShowLibararyCredentialsPicker(false)}
            isOpen={true}
          >
            <table className="filter-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th style={{ width: '34px' }}></th>
                </tr>
              </thead>
              <tbody>
                {libraryCredentials.map((credential) => {
                  return (
                    <tr key={credential.id}>
                      <td>{credential.name}</td>
                      <td>{credential.type}</td>
                      <td>
                        <Button
                          onClick={() => {
                            updateDataSource({ ...dataSource, libraryCredentialId: credential.id });
                            location.reload();
                          }}
                          aria-label={`Edit Library Credential: ${credential.name}`}
                          icon="link"
                          size="md"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Modal>
        )}
      </div>
    </div>
  );
};

export default BasicSettings;
