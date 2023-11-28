import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { PureComponent } from 'react';
import { Subscription } from 'rxjs';
import { AnnotationChangeEvent, AppEvents, dateTime, locationUtil, } from '@grafana/data';
import { config, getBackendSrv, locationService } from '@grafana/runtime';
import { Button, CustomScrollbar, stylesFactory, TagList } from '@grafana/ui';
import { AbstractList } from '@grafana/ui/src/components/List/AbstractList';
import appEvents from 'app/core/app_events';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { AnnotationListItem } from './AnnotationListItem';
export class AnnoListPanel extends PureComponent {
    constructor(props) {
        super(props);
        this.style = getStyles(config.theme2);
        this.subs = new Subscription();
        this.tagListRef = React.createRef();
        this.onAnnoClick = (anno) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (!anno.time) {
                return;
            }
            const { options } = this.props;
            const dashboardSrv = getDashboardSrv();
            const current = dashboardSrv.getCurrent();
            const params = {
                from: this._timeOffset(anno.time, options.navigateBefore, true),
                to: this._timeOffset((_a = anno.timeEnd) !== null && _a !== void 0 ? _a : anno.time, options.navigateAfter, false),
            };
            if (options.navigateToPanel) {
                params.viewPanel = anno.panelId;
            }
            if ((current === null || current === void 0 ? void 0 : current.uid) === anno.dashboardUID) {
                locationService.partial(params);
                return;
            }
            const result = yield getBackendSrv().get('/api/search', { dashboardUIDs: anno.dashboardUID });
            if (result && result.length && result[0].uid === anno.dashboardUID) {
                const dash = result[0];
                const url = new URL(dash.url, window.location.origin);
                url.searchParams.set('from', params.from);
                url.searchParams.set('to', params.to);
                locationService.push(locationUtil.stripBaseFromUrl(url.toString()));
                return;
            }
            appEvents.emit(AppEvents.alertWarning, ['Unknown Dashboard: ' + anno.dashboardUID]);
        });
        this.onTagClick = (tag, remove) => {
            var _a, _b;
            if (!remove && this.state.queryTags.includes(tag)) {
                return;
            }
            const queryTags = remove ? this.state.queryTags.filter((item) => item !== tag) : [...this.state.queryTags, tag];
            // Logic to ensure keyboard focus isn't lost when the currently
            // focused tag is removed
            let nextTag = undefined;
            if (remove) {
                const focusedTag = document.activeElement;
                const dataTagId = focusedTag === null || focusedTag === void 0 ? void 0 : focusedTag.getAttribute('data-tag-id');
                if (((_a = this.tagListRef.current) === null || _a === void 0 ? void 0 : _a.contains(focusedTag)) && dataTagId) {
                    const parsedTagId = Number.parseInt(dataTagId, 10);
                    const possibleNextTag = (_b = this.tagListRef.current.querySelector(`[data-tag-id="${parsedTagId + 1}"]`)) !== null && _b !== void 0 ? _b : this.tagListRef.current.querySelector(`[data-tag-id="${parsedTagId - 1}"]`);
                    if (possibleNextTag instanceof HTMLElement) {
                        nextTag = possibleNextTag;
                    }
                }
            }
            this.setState({ queryTags }, () => nextTag === null || nextTag === void 0 ? void 0 : nextTag.focus());
        };
        this.onUserClick = (anno) => {
            this.setState({
                queryUser: {
                    id: anno.userId,
                    login: anno.login,
                    email: anno.email,
                },
            });
        };
        this.onClearUser = () => {
            this.setState({
                queryUser: undefined,
            });
        };
        this.renderItem = (anno, index) => {
            const { options } = this.props;
            const dashboard = getDashboardSrv().getCurrent();
            if (!dashboard) {
                return React.createElement(React.Fragment, null);
            }
            return (React.createElement(AnnotationListItem, { annotation: anno, formatDate: dashboard.formatDate, onClick: this.onAnnoClick, onAvatarClick: this.onUserClick, onTagClick: this.onTagClick, options: options }));
        };
        this.state = {
            annotations: [],
            timeInfo: '',
            loaded: false,
            queryTags: [],
        };
    }
    componentDidMount() {
        this.doSearch();
        // When an annotation on this dashboard changes, re-run the query
        this.subs.add(this.props.eventBus.getStream(AnnotationChangeEvent).subscribe({
            next: () => {
                this.doSearch();
            },
        }));
    }
    componentWillUnmount() {
        this.subs.unsubscribe();
    }
    componentDidUpdate(prevProps, prevState) {
        const { options, timeRange } = this.props;
        const needsQuery = options !== prevProps.options ||
            this.state.queryTags !== prevState.queryTags ||
            this.state.queryUser !== prevState.queryUser ||
            prevProps.renderCounter !== this.props.renderCounter ||
            (options.onlyInTimeRange && timeRange !== prevProps.timeRange);
        if (needsQuery) {
            this.doSearch();
        }
    }
    doSearch() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            // http://docs.grafana.org/http_api/annotations/
            // https://github.com/grafana/grafana/blob/main/public/app/core/services/backend_srv.ts
            // https://github.com/grafana/grafana/blob/main/public/app/features/annotations/annotations_srv.ts
            const { options } = this.props;
            const { queryUser, queryTags } = this.state;
            const params = {
                tags: options.tags,
                limit: options.limit,
                type: 'annotation', // Skip the Annotations that are really alerts.  (Use the alerts panel!)
            };
            if (options.onlyFromThisDashboard) {
                params.dashboardUID = (_a = getDashboardSrv().getCurrent()) === null || _a === void 0 ? void 0 : _a.uid;
            }
            let timeInfo = '';
            if (options.onlyInTimeRange) {
                const { timeRange } = this.props;
                params.from = timeRange.from.valueOf();
                params.to = timeRange.to.valueOf();
            }
            else {
                timeInfo = 'All Time';
            }
            if (queryUser) {
                params.userId = queryUser.id;
            }
            if (options.tags && options.tags.length) {
                params.tags = options.tags.map((tag) => this.props.replaceVariables(tag));
            }
            if (queryTags.length) {
                params.tags = params.tags ? [...params.tags, ...queryTags] : queryTags;
            }
            const annotations = yield getBackendSrv().get('/api/annotations', params, `anno-list-panel-${this.props.id}`);
            this.setState({
                annotations,
                timeInfo,
                loaded: true,
            });
        });
    }
    _timeOffset(time, offset, subtract = false) {
        let incr = 5;
        let unit = 'm';
        const parts = /^(\d+)(\w)/.exec(offset);
        if (parts && parts.length === 3) {
            incr = parseInt(parts[1], 10);
            unit = parts[2];
        }
        const t = dateTime(time);
        if (subtract) {
            incr *= -1;
        }
        return t.add(incr, unit).valueOf();
    }
    render() {
        const { loaded, annotations, queryUser, queryTags } = this.state;
        if (!loaded) {
            return React.createElement("div", null, "loading...");
        }
        // Previously we showed inidication that it covered all time
        // { timeInfo && (
        //   <span className="panel-time-info">
        //     <Icon name="clock-nine" /> {timeInfo}
        //   </span>
        // )}
        const hasFilter = queryUser || queryTags.length > 0;
        return (React.createElement(CustomScrollbar, { autoHeightMin: "100%" },
            hasFilter && (React.createElement("div", { className: this.style.filter },
                React.createElement("b", null, "Filter:"),
                queryUser && (React.createElement(Button, { size: "sm", variant: "secondary", fill: "text", onClick: this.onClearUser, "aria-label": `Remove filter: ${queryUser.email}` }, queryUser.email)),
                queryTags.length > 0 && (React.createElement(TagList, { icon: "times", tags: queryTags, onClick: (tag) => this.onTagClick(tag, true), getAriaLabel: (name) => `Remove ${name} tag`, className: this.style.tagList, ref: this.tagListRef })))),
            annotations.length < 1 && React.createElement("div", { className: this.style.noneFound }, "No Annotations Found"),
            React.createElement(AbstractList, { items: annotations, renderItem: this.renderItem, getItemKey: (item) => `${item.id}` })));
    }
}
const getStyles = stylesFactory((theme) => ({
    noneFound: css `
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: calc(100% - 30px);
  `,
    filter: css({
        alignItems: 'center',
        display: 'flex',
        flexWrap: 'wrap',
        gap: theme.spacing(0.5),
        padding: theme.spacing(0.5),
    }),
    tagList: css({
        justifyContent: 'flex-start',
        'li > button': {
            paddingLeft: '3px',
        },
    }),
}));
//# sourceMappingURL=AnnoListPanel.js.map