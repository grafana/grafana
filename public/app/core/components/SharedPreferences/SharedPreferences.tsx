import { css } from '@emotion/css';
import { t, Trans } from '@lingui/macro';
import React, { PureComponent } from 'react';

import { SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import {
  Button,
  Field,
  FieldSet,
  Form,
  Icon,
  Label,
  RadioButtonGroup,
  Select,
  stylesFactory,
  TimeZonePicker,
  Tooltip,
  WeekStartPicker,
} from '@grafana/ui';
import { PreferencesService } from 'app/core/services/PreferencesService';
import { backendSrv } from 'app/core/services/backend_srv';
import { DashboardSearchHit, DashboardSearchItemType } from 'app/features/search/types';

import { UserPreferencesDTO } from '../../../types';

export interface Props {
  resourceUri: string;
  disabled?: boolean;
}

export type State = UserPreferencesDTO & {
  dashboards: DashboardSearchHit[];
};

const themes: SelectableValue[] = [
  { value: '', label: t({ id: 'shared-preferences.theme.default-label', message: 'Default' }) },
  { value: 'dark', label: t({ id: 'shared-preferences.theme.dark-label', message: 'Dark' }) },
  { value: 'light', label: t({ id: 'shared-preferences.theme.light-label', message: 'Light' }) },
];

export class SharedPreferences extends PureComponent<Props, State> {
  service: PreferencesService;

  constructor(props: Props) {
    super(props);

    this.service = new PreferencesService(props.resourceUri);
    this.state = {
      homeDashboardId: 0,
      theme: '',
      timezone: '',
      weekStart: '',
      dashboards: [],
      queryHistory: { homeTab: '' },
    };
  }

  async componentDidMount() {
    const prefs = await this.service.load();
    const dashboards = await backendSrv.search({ starred: true });
    const defaultDashboardHit: DashboardSearchHit = {
      id: 0,
      title: 'Default',
      tags: [],
      type: '' as DashboardSearchItemType,
      uid: '',
      uri: '',
      url: '',
      folderId: 0,
      folderTitle: '',
      folderUid: '',
      folderUrl: '',
      isStarred: false,
      slug: '',
      items: [],
    };

    if (prefs.homeDashboardId > 0 && !dashboards.find((d) => d.id === prefs.homeDashboardId)) {
      const missing = await backendSrv.search({ dashboardIds: [prefs.homeDashboardId] });
      if (missing && missing.length > 0) {
        dashboards.push(missing[0]);
      }
    }

    this.setState({
      homeDashboardId: prefs.homeDashboardId,
      theme: prefs.theme,
      timezone: prefs.timezone,
      weekStart: prefs.weekStart,
      dashboards: [defaultDashboardHit, ...dashboards],
      queryHistory: prefs.queryHistory,
    });
  }

  onSubmitForm = async () => {
    const { homeDashboardId, theme, timezone, weekStart, queryHistory } = this.state;
    await this.service.update({ homeDashboardId, theme, timezone, weekStart, queryHistory });
    window.location.reload();
  };

  onThemeChanged = (value: string) => {
    this.setState({ theme: value });
  };

  onTimeZoneChanged = (timezone?: string) => {
    if (!timezone) {
      return;
    }
    this.setState({ timezone: timezone });
  };

  onWeekStartChanged = (weekStart: string) => {
    this.setState({ weekStart: weekStart });
  };

  onHomeDashboardChanged = (dashboardId: number) => {
    this.setState({ homeDashboardId: dashboardId });
  };

  getFullDashName = (dashboard: SelectableValue<DashboardSearchHit>) => {
    if (typeof dashboard.folderTitle === 'undefined' || dashboard.folderTitle === '') {
      return dashboard.title;
    }
    return dashboard.folderTitle + ' / ' + dashboard.title;
  };

  render() {
    const { theme, timezone, weekStart, homeDashboardId, dashboards } = this.state;
    const { disabled } = this.props;
    const styles = getStyles();

    const homeDashboardTooltip = (
      <Tooltip
        content={
          <Trans id="shared-preferences.fields.home-dashboard-tooltip">
            Not finding the dashboard you want? Star it first, then it should appear in this select box.
          </Trans>
        }
      >
        <Icon name="info-circle" />
      </Tooltip>
    );

    return (
      <Form onSubmit={this.onSubmitForm}>
        {() => {
          return (
            <FieldSet label={<Trans id="shared-preferences.title">Preferences</Trans>} disabled={disabled}>
              <Field label={t({ id: 'shared-preferences.fields.theme-label', message: 'UI Theme' })}>
                <RadioButtonGroup
                  options={themes}
                  value={themes.find((item) => item.value === theme)?.value}
                  onChange={this.onThemeChanged}
                />
              </Field>

              <Field
                label={
                  <Label htmlFor="home-dashboard-select">
                    <span className={styles.labelText}>
                      <Trans id="shared-preferences.fields.home-dashboard-label">Home Dashboard</Trans>
                    </span>

                    {homeDashboardTooltip}
                  </Label>
                }
                data-testid="User preferences home dashboard drop down"
              >
                <Select
                  value={dashboards.find((dashboard) => dashboard.id === homeDashboardId)}
                  getOptionValue={(i) => i.id}
                  getOptionLabel={this.getFullDashName}
                  onChange={(dashboard: SelectableValue<DashboardSearchHit>) =>
                    this.onHomeDashboardChanged(dashboard.id)
                  }
                  options={dashboards}
                  placeholder={t({
                    id: 'shared-preferences.fields.home-dashboard-placeholder',
                    message: 'Choose default dashboard',
                  })}
                  inputId="home-dashboard-select"
                />
              </Field>

              <Field
                label={t({ id: 'shared-dashboard.fields.timezone-label', message: 'Timezone' })}
                data-testid={selectors.components.TimeZonePicker.containerV2}
              >
                <TimeZonePicker
                  includeInternal={true}
                  value={timezone}
                  onChange={this.onTimeZoneChanged}
                  inputId="shared-preferences-timezone-picker"
                />
              </Field>

              <Field
                label={t({ id: 'shared-preferences.fields.week-start-label', message: 'Week start' })}
                data-testid={selectors.components.WeekStartPicker.containerV2}
              >
                <WeekStartPicker
                  value={weekStart}
                  onChange={this.onWeekStartChanged}
                  inputId={'shared-preferences-week-start-picker'}
                />
              </Field>

              <div className="gf-form-button-row">
                <Button
                  type="submit"
                  variant="primary"
                  data-testid={selectors.components.UserProfile.preferencesSaveButton}
                >
                  <Trans id="common.save">Save</Trans>
                </Button>
              </div>
            </FieldSet>
          );
        }}
      </Form>
    );
  }
}

export default SharedPreferences;

const getStyles = stylesFactory(() => {
  return {
    labelText: css`
      margin-right: 6px;
    `,
  };
});
