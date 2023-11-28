import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { applyFieldOverrides, LoadingState, FieldType } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { Table, PanelChrome } from '@grafana/ui';
import { config } from 'app/core/config';
import { t } from 'app/core/internationalization';
import { hasDeprecatedParentRowIndex, migrateFromParentRowIndexToNestedFrames, } from 'app/plugins/panel/table/migrations';
import { MetaInfoText } from '../MetaInfoText';
import { selectIsWaitingForData } from '../state/query';
import { exploreDataLinkPostProcessorFactory } from '../utils/links';
function mapStateToProps(state, { exploreId }) {
    const explore = state.explore;
    const item = explore.panes[exploreId];
    const { tableResult, range } = item;
    const loadingInState = selectIsWaitingForData(exploreId);
    const loading = tableResult && tableResult.length > 0 ? false : loadingInState;
    return { loading, tableResult, range };
}
const connector = connect(mapStateToProps, {});
export class TableContainer extends PureComponent {
    constructor() {
        super(...arguments);
        this.hasSubFrames = (data) => data.fields.some((f) => f.type === FieldType.nestedFrames);
    }
    getTableHeight(rowCount, hasSubFrames) {
        if (rowCount === 0) {
            return 200;
        }
        // tries to estimate table height, with a min of 300 and a max of 600
        // if there are multiple tables, there is no min
        return Math.min(600, Math.max(rowCount * 36, hasSubFrames ? 300 : 0) + 40 + 46);
    }
    getTableTitle(dataFrames, data, i) {
        var _a;
        let name = data.name;
        if (!name && ((_a = dataFrames === null || dataFrames === void 0 ? void 0 : dataFrames.length) !== null && _a !== void 0 ? _a : 0) > 1) {
            name = data.refId || `${i}`;
        }
        return name ? t('explore.table.title-with-name', 'Table - {{name}}', { name }) : t('explore.table.title', 'Table');
    }
    render() {
        const { loading, onCellFilterAdded, tableResult, width, splitOpenFn, range, ariaLabel, timeZone } = this.props;
        let dataFrames = hasDeprecatedParentRowIndex(tableResult)
            ? migrateFromParentRowIndexToNestedFrames(tableResult)
            : tableResult;
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
        return (React.createElement(React.Fragment, null,
            frames && frames.length === 0 && (React.createElement(PanelChrome, { title: t('explore.table.title', 'Table'), width: width, height: 200 }, () => React.createElement(MetaInfoText, { metaItems: [{ value: t('explore.table.no-data', '0 series returned') }] }))),
            frames &&
                frames.length > 0 &&
                frames.map((data, i) => (React.createElement(PanelChrome, { key: data.refId || `table-${i}`, title: this.getTableTitle(dataFrames, data, i), width: width, height: this.getTableHeight(data.length, this.hasSubFrames(data)), loadingState: loading ? LoadingState.Loading : undefined }, (innerWidth, innerHeight) => (React.createElement(Table, { ariaLabel: ariaLabel, data: data, width: innerWidth, height: innerHeight, onCellFilterAdded: onCellFilterAdded })))))));
    }
}
export default connector(TableContainer);
//# sourceMappingURL=TableContainer.js.map