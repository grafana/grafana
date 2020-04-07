import React, { ChangeEvent, FC } from 'react';
import { LegacyForms } from '@grafana/ui';
const { Input } = LegacyForms;

export interface Props {
  orgName: string;
  onSubmit: () => void;
  onOrgNameChange: (orgName: string) => void;
}

const OrgProfile: FC<Props> = ({ onSubmit, onOrgNameChange, orgName }) => {
  return (
    <div>
      <h3 className="page-sub-heading">Organization profile</h3>
      <form
        name="orgForm"
        className="gf-form-group"
        onSubmit={event => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="gf-form-inline">
          <div className="gf-form max-width-28">
            <span className="gf-form-label">Organization name</span>
            <Input
              className="gf-form-input"
              type="text"
              onChange={(event: ChangeEvent<HTMLInputElement>) => onOrgNameChange(event.target.value)}
              value={orgName}
            />
          </div>
        </div>
        <div className="gf-form-button-row">
          <button type="submit" className="btn btn-primary">
            Save
          </button>
        </div>
      </form>
    </div>
  );
};

export default OrgProfile;
