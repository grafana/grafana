import React, { SFC } from 'react';
import Tooltip from '../../core/components/Tooltip/Tooltip';
import { DashboardAcl, OrganisationPreferences } from 'app/types';
import SimplePicker from '../../core/components/Picker/SimplePicker';

interface Props {
  preferences: OrganisationPreferences;
  starredDashboards: DashboardAcl[];
  onDashboardSelected: (dashboard: DashboardAcl) => void;
  onTimeZoneChange: (timeZone: string) => void;
  onSubmit: () => void;
}

const OrgPreferences: SFC<Props> = ({
  preferences,
  starredDashboards,
  onDashboardSelected,
  onSubmit,
  onTimeZoneChange,
}) => {
  const themes = [{ value: '', text: 'Default' }, { value: 'dark', text: 'Dark' }, { value: 'light', text: 'Light' }];

  const timezones = [
    { value: '', text: 'Default' },
    { value: 'browser', text: 'Local browser time' },
    { value: 'utc', text: 'UTC' },
  ];

  return (
    <form className="section gf-form-group" onSubmit={onSubmit}>
      <h3 className="page-heading">Preferences</h3>
      <div className="gf-form">
        <span className="gf-form-label width-11">UI Theme</span>
        <SimplePicker
          options={themes}
          getOptionValue={i => i.value}
          getOptionLabel={i => i.text}
          onSelected={theme => {
            console.log(theme);
          }}
        />
      </div>
      <div className="gf-form">
        <span className="gf-form-label width-11">
          Home Dashboard
          <Tooltip
            className="gf-form-help-icon gf-form-help-icon--right-normal"
            placement="right"
            content="Not finding dashboard you want? Star it first, then it should appear in this select box."
          >
            <i className="fa fa-info-circle" />
          </Tooltip>
        </span>
        <SimplePicker
          getOptionLabel={i => i.title}
          getOptionValue={i => i.id}
          onSelected={dashboard => onDashboardSelected(dashboard)}
          options={starredDashboards}
        />
      </div>
      <div className="gf-form">
        <label className="gf-form-label width-11">Timezone</label>

        <SimplePicker
          className="gf-form-input"
          onSelected={timezone => {
            console.log(timezone);
          }}
          options={timezones}
          getOptionLabel={i => i.text}
          getOptionValue={i => i.value}
        />
      </div>
      <div className="gf-form-button-row">
        <button type="submit" className="btn btn-success">
          Save
        </button>
      </div>
    </form>
  );
};

export default OrgPreferences;
