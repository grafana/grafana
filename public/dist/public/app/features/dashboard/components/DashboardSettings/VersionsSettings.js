import { __awaiter } from "tslib";
import React, { PureComponent } from 'react';
import { config } from '@grafana/runtime';
import { Spinner, HorizontalGroup } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { historySrv, VersionHistoryTable, VersionHistoryHeader, VersionsHistoryButtons, VersionHistoryComparison, } from '../VersionHistory';
export const VERSIONS_FETCH_LIMIT = 10;
export class VersionsSettings extends PureComponent {
    constructor(props) {
        super(props);
        this.getVersions = (append = false) => {
            this.setState({ isAppending: append });
            historySrv
                .getHistoryList(this.props.dashboard, { limit: this.limit, start: this.start })
                .then((res) => {
                this.setState({
                    isLoading: false,
                    versions: [...this.state.versions, ...this.decorateVersions(res)],
                });
                this.start += this.limit;
            })
                .catch((err) => console.log(err))
                .finally(() => this.setState({ isAppending: false }));
        };
        this.getDiff = () => __awaiter(this, void 0, void 0, function* () {
            const selectedVersions = this.state.versions.filter((version) => version.checked);
            const [newInfo, baseInfo] = selectedVersions;
            const isNewLatest = newInfo.version === this.props.dashboard.version;
            this.setState({
                isLoading: true,
            });
            const lhs = yield historySrv.getDashboardVersion(this.props.dashboard.uid, baseInfo.version);
            const rhs = yield historySrv.getDashboardVersion(this.props.dashboard.uid, newInfo.version);
            this.setState({
                baseInfo,
                isLoading: false,
                isNewLatest,
                newInfo,
                viewMode: 'compare',
                diffData: {
                    lhs: lhs.data,
                    rhs: rhs.data,
                },
            });
        });
        this.decorateVersions = (versions) => versions.map((version) => (Object.assign(Object.assign({}, version), { createdDateString: this.props.dashboard.formatDate(version.created), ageString: this.props.dashboard.getRelativeTime(version.created), checked: false })));
        this.onCheck = (ev, versionId) => {
            this.setState({
                versions: this.state.versions.map((version) => version.id === versionId ? Object.assign(Object.assign({}, version), { checked: ev.currentTarget.checked }) : version),
            });
        };
        this.reset = () => {
            this.setState({
                baseInfo: undefined,
                diffData: {
                    lhs: {},
                    rhs: {},
                },
                isNewLatest: false,
                newInfo: undefined,
                versions: this.state.versions.map((version) => (Object.assign(Object.assign({}, version), { checked: false }))),
                viewMode: 'list',
            });
        };
        this.limit = VERSIONS_FETCH_LIMIT;
        this.start = 0;
        this.state = {
            isAppending: true,
            isLoading: true,
            versions: [],
            viewMode: 'list',
            isNewLatest: false,
            diffData: {
                lhs: {},
                rhs: {},
            },
        };
    }
    componentDidMount() {
        this.getVersions();
    }
    isLastPage() {
        return this.state.versions.find((rev) => rev.version === 1);
    }
    render() {
        const { versions, viewMode, baseInfo, newInfo, isNewLatest, isLoading, diffData } = this.state;
        const canCompare = versions.filter((version) => version.checked).length === 2;
        const showButtons = versions.length > 1;
        const hasMore = versions.length >= this.limit;
        const pageNav = config.featureToggles.dockedMegaMenu ? this.props.sectionNav.node.parentItem : undefined;
        if (viewMode === 'compare') {
            return (React.createElement(Page, { navModel: this.props.sectionNav, pageNav: pageNav },
                React.createElement(VersionHistoryHeader, { onClick: this.reset, baseVersion: baseInfo === null || baseInfo === void 0 ? void 0 : baseInfo.version, newVersion: newInfo === null || newInfo === void 0 ? void 0 : newInfo.version, isNewLatest: isNewLatest }),
                isLoading ? (React.createElement(VersionsHistorySpinner, { msg: "Fetching changes\u2026" })) : (React.createElement(VersionHistoryComparison, { newInfo: newInfo, baseInfo: baseInfo, isNewLatest: isNewLatest, diffData: diffData }))));
        }
        return (React.createElement(Page, { navModel: this.props.sectionNav, pageNav: pageNav },
            isLoading ? (React.createElement(VersionsHistorySpinner, { msg: "Fetching history list\u2026" })) : (React.createElement(VersionHistoryTable, { versions: versions, onCheck: this.onCheck, canCompare: canCompare })),
            this.state.isAppending && React.createElement(VersionsHistorySpinner, { msg: "Fetching more entries\u2026" }),
            showButtons && (React.createElement(VersionsHistoryButtons, { hasMore: hasMore, canCompare: canCompare, getVersions: this.getVersions, getDiff: this.getDiff, isLastPage: !!this.isLastPage() }))));
    }
}
const VersionsHistorySpinner = ({ msg }) => (React.createElement(HorizontalGroup, null,
    React.createElement(Spinner, null),
    React.createElement("em", null, msg)));
//# sourceMappingURL=VersionsSettings.js.map