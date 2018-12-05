import React, { SFC } from 'react';
import { Label } from 'app/core/components/Label/Label';
import { Switch } from '../../../core/components/Switch/Switch';

export interface Props {
  dataSourceName: string;
  isDefault: boolean;
  onNameChange: (name: string) => void;
  onDefaultChange: (value: boolean) => void;
}

const BasicSettings: SFC<Props> = ({ dataSourceName, isDefault, onDefaultChange, onNameChange }) => {
  return (
    <div className="gf-form-group">
      <div className="gf-form-inline">
        <div className="gf-form max-width-30" style={{ marginRight: '3px' }}>
          <Label
            tooltip={
              'The name is used when you select the data source in panels. The Default data source is' +
              'preselected in new panels.'
            }
          >
            Name
          </Label>
          <input
            className="gf-form-input max-width-23"
            type="text"
            value={dataSourceName}
            placeholder="Name"
            onChange={event => onNameChange(event.target.value)}
            required
          />
        </div>
        <Switch label="Default" checked={isDefault} onChange={event => onDefaultChange(event.target.checked)} />
      </div>
    </div>
  );
};

export default BasicSettings;
