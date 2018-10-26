import React, { SFC } from 'react';
import Tooltip from '../../core/components/Tooltip/Tooltip';
import SimplePicker from '../../core/components/Picker/SimplePicker';
import { DashboardAcl, OrganizationPreferences } from 'app/types';

interface Props {
  preferences: OrganizationPreferences;
  starredDashboards: DashboardAcl[];
  onDashboardChange: (dashboardId: number) => void;
  onTimeZoneChange: (timeZone: string) => void;
  onThemeChange: (theme: string) => void;
  onSubmit: () => void;
}

const OrgPreferences: SFC<Props> = ({
  preferences,
  starredDashboards,
  onDashboardChange,
  onSubmit,
  onTimeZoneChange,
  onThemeChange,
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
          onSelected={theme => onThemeChange(theme)}
          width={20}
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
          getOptionValue={i => i.id}
          getOptionLabel={i => i.title}
          onSelected={(dashboard: DashboardAcl) => onDashboardChange(dashboard.id)}
          options={starredDashboards}
          placeholder="Chose default dashboard"
          width={20}
        />
      </div>
      <div className="gf-form">
        <label className="gf-form-label width-11">Timezone</label>
        <SimplePicker
          getOptionValue={i => i.value}
          getOptionLabel={i => i.text}
          onSelected={timezone => onTimeZoneChange(timezone)}
          options={timezones}
          width={20}
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
