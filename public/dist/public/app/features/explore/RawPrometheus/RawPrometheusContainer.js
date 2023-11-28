import { css } from '@emotion/css';
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { applyFieldOverrides } from '@grafana/data';
import { getTemplateSrv, reportInteraction } from '@grafana/runtime';
import { Collapse, RadioButtonGroup, Table } from '@grafana/ui';
import { config } from 'app/core/config';
import { PANEL_BORDER } from 'app/core/constants';
import { TABLE_RESULTS_STYLE } from 'app/types';
import { TABLE_RESULTS_STYLES } from 'app/types/explore';
import { MetaInfoText } from '../MetaInfoText';
import RawListContainer from '../PrometheusListView/RawListContainer';
import { selectIsWaitingForData } from '../state/query';
import { exploreDataLinkPostProcessorFactory } from '../utils/links';
function mapStateToProps(state, { exploreId }) {
    var _a;
    const explore = state.explore;
    const item = explore.panes[exploreId];
    const { tableResult, rawPrometheusResult, range } = item;
    const loadingInState = selectIsWaitingForData(exploreId)(state);
    const rawPrometheusFrame = rawPrometheusResult ? [rawPrometheusResult] : [];
    const result = ((_a = tableResult === null || tableResult === void 0 ? void 0 : tableResult.length) !== null && _a !== void 0 ? _a : false) > 0 && rawPrometheusResult ? tableResult : rawPrometheusFrame;
    const loading = result && result.length > 0 ? false : loadingInState;
    return { loading, tableResult: result, range };
}
const connector = connect(mapStateToProps, {});
export class RawPrometheusContainer extends PureComponent {
    constructor(props) {
        super(props);
        this.onChangeResultsStyle = (resultsStyle) => {
            this.setState({ resultsStyle });
        };
        this.renderLabel = () => {
            var _a;
            const spacing = css({
                display: 'flex',
                justifyContent: 'space-between',
                flex: '1',
            });
            const ALL_GRAPH_STYLE_OPTIONS = TABLE_RESULTS_STYLES.map((style) => ({
                value: style,
                // capital-case it and switch `_` to ` `
                label: style[0].toUpperCase() + style.slice(1).replace(/_/, ' '),
            }));
            return (React.createElement("div", { className: spacing },
                this.state.resultsStyle === TABLE_RESULTS_STYLE.raw ? 'Raw' : 'Table',
                React.createElement(RadioButtonGroup, { onClick: () => {
                        const props = {
                            state: this.state.resultsStyle === TABLE_RESULTS_STYLE.table
                                ? TABLE_RESULTS_STYLE.raw
                                : TABLE_RESULTS_STYLE.table,
                        };
                        reportInteraction('grafana_explore_prometheus_instant_query_ui_toggle_clicked', props);
                    }, size: "sm", options: ALL_GRAPH_STYLE_OPTIONS, value: (_a = this.state) === null || _a === void 0 ? void 0 : _a.resultsStyle, onChange: this.onChangeResultsStyle })));
        };
        // If resultsStyle is undefined we won't render the toggle, and the default table will be rendered
        if (props.showRawPrometheus) {
            this.state = {
                resultsStyle: TABLE_RESULTS_STYLE.raw,
            };
        }
    }
    getTableHeight() {
        const { tableResult } = this.props;
        if (!tableResult || tableResult.length === 0) {
            return 200;
        }
        // tries to estimate table height
        return Math.max(Math.min(600, tableResult[0].length * 35) + 35);
    }
    render() {
        var _a, _b, _c, _d;
        const { loading, onCellFilterAdded, tableResult, width, splitOpenFn, range, ariaLabel, timeZone } = this.props;
        const height = this.getTableHeight();
        const tableWidth = width - config.theme.panelPadding * 2 - PANEL_BORDER;
        let dataFrames = tableResult;
        const dataLinkPostProcessor = exploreDataLinkPostProcessorFactory(splitOpenFn, range);
        if (dataFrames === null || dataFrames === void 0 ? void 0 : dataFrames.length) {
            dataFrames = applyFieldOverrides({
                data: dataFrames,
                timeZone,
                theme: config.theme2,
                replaceVariables: getTemplateSrv().replace.bind(getTemplateSrv()),
                fieldConfig: {
                    defaults: {},
                    overrides: [],
                },
                dataLinkPostProcessor,
            });
        }
        const frames = dataFrames === null || dataFrames === void 0 ? void 0 : dataFrames.filter((frame) => !!frame && frame.length !== 0);
        const label = ((_a = this.state) === null || _a === void 0 ? void 0 : _a.resultsStyle) !== undefined ? this.renderLabel() : 'Table';
        // Render table as default if resultsStyle is not set.
        const renderTable = !((_b = this.state) === null || _b === void 0 ? void 0 : _b.resultsStyle) || ((_c = this.state) === null || _c === void 0 ? void 0 : _c.resultsStyle) === TABLE_RESULTS_STYLE.table;
        return (React.createElement(Collapse, { label: label, loading: loading, isOpen: true },
            (frames === null || frames === void 0 ? void 0 : frames.length) && (React.createElement(React.Fragment, null,
                renderTable && (React.createElement(Table, { ariaLabel: ariaLabel, data: frames[0], width: tableWidth, height: height, onCellFilterAdded: onCellFilterAdded })),
                ((_d = this.state) === null || _d === void 0 ? void 0 : _d.resultsStyle) === TABLE_RESULTS_STYLE.raw && React.createElement(RawListContainer, { tableResult: frames[0] }))),
            !(frames === null || frames === void 0 ? void 0 : frames.length) && React.createElement(MetaInfoText, { metaItems: [{ value: '0 series returned' }] })));
    }
}
export default connector(RawPrometheusContainer);
//# sourceMappingURL=RawPrometheusContainer.js.map