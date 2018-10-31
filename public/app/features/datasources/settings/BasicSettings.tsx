import React, { SFC } from 'react';
import { Label } from '../../../core/components/Forms/Forms';

export interface Props {
  dataSourceName: string;
  onChange: (name: string) => void;
}

const BasicSettings: SFC<Props> = ({ dataSourceName, onChange }) => {
  return (
    <div className="gf-form-group">
      <div className="gf-form max-width-30">
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
          onChange={event => onChange(event.target.value)}
          required
        />
      </div>
    </div>
  );
};

export default BasicSettings;
