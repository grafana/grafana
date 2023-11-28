import { isEmpty } from 'lodash';
import React, { PureComponent } from 'react';
import { rangeUtil } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { CollapsableSection, Field, Input, Switch, TimeZonePicker, WeekStartPicker } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { AutoRefreshIntervals } from './AutoRefreshIntervals';
export class TimePickerSettings extends PureComponent {
    constructor() {
        super(...arguments);
        this.state = { isNowDelayValid: true };
        this.onNowDelayChange = (event) => {
            const value = event.currentTarget.value;
            if (isEmpty(value)) {
                this.setState({ isNowDelayValid: true });
                return this.props.onNowDelayChange(value);
            }
            if (rangeUtil.isValidTimeSpan(value)) {
                this.setState({ isNowDelayValid: true });
                return this.props.onNowDelayChange(value);
            }
            this.setState({ isNowDelayValid: false });
        };
        this.onHideTimePickerChange = () => {
            this.props.onHideTimePickerChange(!this.props.timePickerHidden);
        };
        this.onLiveNowChange = () => {
            this.props.onLiveNowChange(!this.props.liveNow);
        };
        this.onTimeZoneChange = (timeZone) => {
            if (typeof timeZone !== 'string') {
                return;
            }
            this.props.onTimeZoneChange(timeZone);
        };
        this.onWeekStartChange = (weekStart) => {
            this.props.onWeekStartChange(weekStart);
        };
    }
    render() {
        return (React.createElement(CollapsableSection, { label: t('dashboard-settings.time-picker.time-options-label', 'Time options'), isOpen: true },
            React.createElement(Field, { label: t('dashboard-settings.time-picker.time-zone-label', 'Time zone'), "data-testid": selectors.components.TimeZonePicker.containerV2 },
                React.createElement(TimeZonePicker, { inputId: "time-options-input", includeInternal: true, value: this.props.timezone, onChange: this.onTimeZoneChange, width: 40 })),
            React.createElement(Field, { label: t('dashboard-settings.time-picker.week-start-label', 'Week start'), "data-testid": selectors.components.WeekStartPicker.containerV2 },
                React.createElement(WeekStartPicker, { inputId: "week-start-input", width: 40, value: this.props.weekStart, onChange: this.onWeekStartChange })),
            React.createElement(AutoRefreshIntervals, { refreshIntervals: this.props.refreshIntervals, onRefreshIntervalChange: this.props.onRefreshIntervalChange }),
            React.createElement(Field, { label: t('dashboard-settings.time-picker.now-delay-label', 'Now delay'), description: t('dashboard-settings.time-picker.now-delay-description', 'Exclude recent data that may be incomplete.') },
                React.createElement(Input, { id: "now-delay-input", invalid: !this.state.isNowDelayValid, placeholder: "0m", onChange: this.onNowDelayChange, defaultValue: this.props.nowDelay })),
            React.createElement(Field, { label: t('dashboard-settings.time-picker.hide-time-picker', 'Hide time picker') },
                React.createElement(Switch, { id: "hide-time-picker-toggle", value: !!this.props.timePickerHidden, onChange: this.onHideTimePickerChange })),
            React.createElement(Field, { label: t('dashboard-settings.time-picker.refresh-live-dashboards-label', 'Refresh live dashboards'), description: t('dashboard-settings.time-picker.refresh-live-dashboards-description', "Continuously re-draw panels where the time range references 'now'") },
                React.createElement(Switch, { id: "refresh-live-dashboards-toggle", value: !!this.props.liveNow, onChange: this.onLiveNowChange }))));
    }
}
//# sourceMappingURL=TimePickerSettings.js.map