import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { PureComponent } from 'react';
import { FeatureState, getBuiltInThemes } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config, reportInteraction } from '@grafana/runtime';
import { Button, Field, FieldSet, Form, Label, Select, stylesFactory, TimeZonePicker, WeekStartPicker, FeatureBadge, } from '@grafana/ui';
import { DashboardPicker } from 'app/core/components/Select/DashboardPicker';
import { t, Trans } from 'app/core/internationalization';
import { LANGUAGES } from 'app/core/internationalization/constants';
import { PreferencesService } from 'app/core/services/PreferencesService';
import { changeTheme } from 'app/core/services/theme';
function getLanguageOptions() {
    const languageOptions = LANGUAGES.map((v) => ({
        value: v.code,
        label: v.name,
    }));
    const options = [
        {
            value: '',
            label: t('common.locale.default', 'Default'),
        },
        ...languageOptions,
    ];
    return options;
}
export class SharedPreferences extends PureComponent {
    constructor(props) {
        super(props);
        this.onSubmitForm = () => __awaiter(this, void 0, void 0, function* () {
            const confirmationResult = this.props.onConfirm ? yield this.props.onConfirm() : true;
            if (confirmationResult) {
                const { homeDashboardUID, theme, timezone, weekStart, language, queryHistory } = this.state;
                yield this.service.update({ homeDashboardUID, theme, timezone, weekStart, language, queryHistory });
                window.location.reload();
            }
        });
        this.onThemeChanged = (value) => {
            this.setState({ theme: value.value });
            if (value.value) {
                changeTheme(value.value, true);
            }
        };
        this.onTimeZoneChanged = (timezone) => {
            if (typeof timezone !== 'string') {
                return;
            }
            this.setState({ timezone: timezone });
        };
        this.onWeekStartChanged = (weekStart) => {
            this.setState({ weekStart: weekStart });
        };
        this.onHomeDashboardChanged = (dashboardUID) => {
            this.setState({ homeDashboardUID: dashboardUID });
        };
        this.onLanguageChanged = (language) => {
            this.setState({ language });
            reportInteraction('grafana_preferences_language_changed', {
                toLanguage: language,
                preferenceType: this.props.preferenceType,
            });
        };
        this.service = new PreferencesService(props.resourceUri);
        this.state = {
            theme: '',
            timezone: '',
            weekStart: '',
            language: '',
            queryHistory: { homeTab: '' },
        };
        this.themeOptions = getBuiltInThemes(config.featureToggles.extraThemes).map((theme) => ({
            value: theme.id,
            label: getTranslatedThemeName(theme),
        }));
        // Add default option
        this.themeOptions.unshift({ value: '', label: t('shared-preferences.theme.default-label', 'Default') });
    }
    componentDidMount() {
        return __awaiter(this, void 0, void 0, function* () {
            const prefs = yield this.service.load();
            this.setState({
                homeDashboardUID: prefs.homeDashboardUID,
                theme: prefs.theme,
                timezone: prefs.timezone,
                weekStart: prefs.weekStart,
                language: prefs.language,
                queryHistory: prefs.queryHistory,
            });
        });
    }
    render() {
        var _a;
        const { theme, timezone, weekStart, homeDashboardUID, language } = this.state;
        const { disabled } = this.props;
        const styles = getStyles();
        const languages = getLanguageOptions();
        const currentThemeOption = (_a = this.themeOptions.find((x) => x.value === theme)) !== null && _a !== void 0 ? _a : this.themeOptions[0];
        return (React.createElement(Form, { onSubmit: this.onSubmitForm }, () => {
            return (React.createElement(React.Fragment, null,
                React.createElement(FieldSet, { label: React.createElement(Trans, { i18nKey: "shared-preferences.title" }, "Preferences"), disabled: disabled },
                    React.createElement(Field, { label: t('shared-preferences.fields.theme-label', 'Interface theme') },
                        React.createElement(Select, { options: this.themeOptions, value: currentThemeOption, onChange: this.onThemeChanged, inputId: "shared-preferences-theme-select" })),
                    React.createElement(Field, { label: React.createElement(Label, { htmlFor: "home-dashboard-select" },
                            React.createElement("span", { className: styles.labelText },
                                React.createElement(Trans, { i18nKey: "shared-preferences.fields.home-dashboard-label" }, "Home Dashboard"))), "data-testid": "User preferences home dashboard drop down" },
                        React.createElement(DashboardPicker, { value: homeDashboardUID, onChange: (v) => { var _a; return this.onHomeDashboardChanged((_a = v === null || v === void 0 ? void 0 : v.uid) !== null && _a !== void 0 ? _a : ''); }, defaultOptions: true, isClearable: true, placeholder: t('shared-preferences.fields.home-dashboard-placeholder', 'Default dashboard'), inputId: "home-dashboard-select" })),
                    React.createElement(Field, { label: t('shared-dashboard.fields.timezone-label', 'Timezone'), "data-testid": selectors.components.TimeZonePicker.containerV2 },
                        React.createElement(TimeZonePicker, { includeInternal: true, value: timezone, onChange: this.onTimeZoneChanged, inputId: "shared-preferences-timezone-picker" })),
                    React.createElement(Field, { label: t('shared-preferences.fields.week-start-label', 'Week start'), "data-testid": selectors.components.WeekStartPicker.containerV2 },
                        React.createElement(WeekStartPicker, { value: weekStart || '', onChange: this.onWeekStartChanged, inputId: 'shared-preferences-week-start-picker' })),
                    React.createElement(Field, { label: React.createElement(Label, { htmlFor: "locale-select" },
                            React.createElement("span", { className: styles.labelText },
                                React.createElement(Trans, { i18nKey: "shared-preferences.fields.locale-label" }, "Language")),
                            React.createElement(FeatureBadge, { featureState: FeatureState.beta })), "data-testid": "User preferences language drop down" },
                        React.createElement(Select, { value: languages.find((lang) => lang.value === language), onChange: (lang) => { var _a; return this.onLanguageChanged((_a = lang.value) !== null && _a !== void 0 ? _a : ''); }, options: languages, placeholder: t('shared-preferences.fields.locale-placeholder', 'Choose language'), inputId: "locale-select" }))),
                React.createElement(Button, { type: "submit", variant: "primary", "data-testid": selectors.components.UserProfile.preferencesSaveButton },
                    React.createElement(Trans, { i18nKey: "common.save" }, "Save"))));
        }));
    }
}
export default SharedPreferences;
const getStyles = stylesFactory(() => {
    return {
        labelText: css `
      margin-right: 6px;
    `,
    };
});
function getTranslatedThemeName(theme) {
    switch (theme.id) {
        case 'dark':
            return t('shared.preferences.theme.dark-label', 'Dark');
        case 'light':
            return t('shared.preferences.theme.light-label', 'Light');
        case 'system':
            return t('shared.preferences.theme.system-label', 'System preference');
        default:
            return theme.name;
    }
}
//# sourceMappingURL=SharedPreferences.js.map