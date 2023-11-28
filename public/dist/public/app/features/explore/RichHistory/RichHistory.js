import { debounce } from 'lodash';
import React, { PureComponent } from 'react';
import { TabbedContainer, withTheme2 } from '@grafana/ui';
import { SortOrder } from 'app/core/utils/richHistory';
import { supportedFeatures } from '../../../core/history/richHistoryStorageProvider';
import { RichHistoryQueriesTab } from './RichHistoryQueriesTab';
import { RichHistorySettingsTab } from './RichHistorySettingsTab';
import { RichHistoryStarredTab } from './RichHistoryStarredTab';
export var Tabs;
(function (Tabs) {
    Tabs["RichHistory"] = "Query history";
    Tabs["Starred"] = "Starred";
    Tabs["Settings"] = "Settings";
})(Tabs || (Tabs = {}));
export const getSortOrderOptions = () => [
    { label: 'Newest first', value: SortOrder.Descending },
    { label: 'Oldest first', value: SortOrder.Ascending },
    { label: 'Data source A-Z', value: SortOrder.DatasourceAZ },
    { label: 'Data source Z-A', value: SortOrder.DatasourceZA },
].filter((option) => supportedFeatures().availableFilters.includes(option.value));
class UnThemedRichHistory extends PureComponent {
    constructor() {
        super(...arguments);
        this.state = {
            loading: false,
        };
        this.updateSettings = (settingsToUpdate) => {
            this.props.updateHistorySettings(Object.assign(Object.assign({}, this.props.richHistorySettings), settingsToUpdate));
        };
        this.updateFilters = (filtersToUpdate) => {
            const filters = Object.assign(Object.assign(Object.assign({}, this.props.richHistorySearchFilters), filtersToUpdate), { page: 1 });
            this.props.updateHistorySearchFilters(this.props.exploreId, filters);
            this.loadRichHistory();
        };
        this.clearResults = () => {
            this.props.clearRichHistoryResults(this.props.exploreId);
        };
        this.loadRichHistory = debounce(() => {
            this.props.loadRichHistory(this.props.exploreId);
            this.setState({
                loading: true,
            });
        }, 300);
        this.onChangeRetentionPeriod = (retentionPeriod) => {
            if (retentionPeriod.value !== undefined) {
                this.updateSettings({ retentionPeriod: retentionPeriod.value });
            }
        };
        this.toggleStarredTabAsFirstTab = () => this.updateSettings({ starredTabAsFirstTab: !this.props.richHistorySettings.starredTabAsFirstTab });
        this.toggleActiveDatasourceOnly = () => this.updateSettings({ activeDatasourceOnly: !this.props.richHistorySettings.activeDatasourceOnly });
    }
    componentDidUpdate(prevProps) {
        if (prevProps.richHistory !== this.props.richHistory) {
            this.setState({
                loading: false,
            });
        }
    }
    render() {
        const { richHistory, richHistoryTotal, height, exploreId, deleteRichHistory, onClose, firstTab, activeDatasourceInstance, } = this.props;
        const { loading } = this.state;
        const QueriesTab = {
            label: 'Query history',
            value: Tabs.RichHistory,
            content: (React.createElement(RichHistoryQueriesTab, { queries: richHistory, totalQueries: richHistoryTotal || 0, loading: loading, updateFilters: this.updateFilters, clearRichHistoryResults: () => this.props.clearRichHistoryResults(this.props.exploreId), loadMoreRichHistory: () => this.props.loadMoreRichHistory(this.props.exploreId), activeDatasourceInstance: activeDatasourceInstance, richHistorySettings: this.props.richHistorySettings, richHistorySearchFilters: this.props.richHistorySearchFilters, exploreId: exploreId, height: height })),
            icon: 'history',
        };
        const StarredTab = {
            label: 'Starred',
            value: Tabs.Starred,
            content: (React.createElement(RichHistoryStarredTab, { queries: richHistory, totalQueries: richHistoryTotal || 0, loading: loading, activeDatasourceInstance: activeDatasourceInstance, updateFilters: this.updateFilters, clearRichHistoryResults: () => this.props.clearRichHistoryResults(this.props.exploreId), loadMoreRichHistory: () => this.props.loadMoreRichHistory(this.props.exploreId), richHistorySettings: this.props.richHistorySettings, richHistorySearchFilters: this.props.richHistorySearchFilters, exploreId: exploreId })),
            icon: 'star',
        };
        const SettingsTab = {
            label: 'Settings',
            value: Tabs.Settings,
            content: (React.createElement(RichHistorySettingsTab, { retentionPeriod: this.props.richHistorySettings.retentionPeriod, starredTabAsFirstTab: this.props.richHistorySettings.starredTabAsFirstTab, activeDatasourceOnly: this.props.richHistorySettings.activeDatasourceOnly, onChangeRetentionPeriod: this.onChangeRetentionPeriod, toggleStarredTabAsFirstTab: this.toggleStarredTabAsFirstTab, toggleactiveDatasourceOnly: this.toggleActiveDatasourceOnly, deleteRichHistory: deleteRichHistory })),
            icon: 'sliders-v-alt',
        };
        let tabs = [QueriesTab, StarredTab, SettingsTab];
        return (React.createElement(TabbedContainer, { tabs: tabs, onClose: onClose, defaultTab: firstTab, closeIconTooltip: "Close query history" }));
    }
}
export const RichHistory = withTheme2(UnThemedRichHistory);
//# sourceMappingURL=RichHistory.js.map