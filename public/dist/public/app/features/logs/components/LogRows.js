import { __rest } from "tslib";
import { cx } from '@emotion/css';
import memoizeOne from 'memoize-one';
import React, { PureComponent } from 'react';
import { LogsDedupStrategy, } from '@grafana/data';
import { withTheme2 } from '@grafana/ui';
import { UniqueKeyMaker } from '../UniqueKeyMaker';
import { sortLogRows } from '../utils';
//Components
import { LogRow } from './LogRow';
import { getLogRowStyles } from './getLogRowStyles';
export const PREVIEW_LIMIT = 100;
class UnThemedLogRows extends PureComponent {
    constructor() {
        super(...arguments);
        this.renderAllTimer = null;
        this.state = {
            renderAll: false,
        };
        /**
         * Toggle the `contextIsOpen` state when a context of one LogRow is opened in order to not show the menu of the other log rows.
         */
        this.openContext = (row, onClose) => {
            if (this.props.onOpenContext) {
                this.props.onOpenContext(row, onClose);
            }
        };
        this.makeGetRows = memoizeOne((orderedRows) => {
            return () => orderedRows;
        });
        this.sortLogs = memoizeOne((logRows, logsSortOrder) => sortLogRows(logRows, logsSortOrder));
    }
    componentDidMount() {
        // Staged rendering
        const { logRows, previewLimit } = this.props;
        const rowCount = logRows ? logRows.length : 0;
        // Render all right away if not too far over the limit
        const renderAll = rowCount <= previewLimit * 2;
        if (renderAll) {
            this.setState({ renderAll });
        }
        else {
            this.renderAllTimer = window.setTimeout(() => this.setState({ renderAll: true }), 2000);
        }
    }
    componentWillUnmount() {
        if (this.renderAllTimer) {
            clearTimeout(this.renderAllTimer);
        }
    }
    render() {
        const _a = this.props, { deduplicatedRows, logRows, dedupStrategy, theme, logsSortOrder, previewLimit } = _a, rest = __rest(_a, ["deduplicatedRows", "logRows", "dedupStrategy", "theme", "logsSortOrder", "previewLimit"]);
        const { renderAll } = this.state;
        const styles = getLogRowStyles(theme);
        const dedupedRows = deduplicatedRows ? deduplicatedRows : logRows;
        const hasData = logRows && logRows.length > 0;
        const dedupCount = dedupedRows
            ? dedupedRows.reduce((sum, row) => (row.duplicates ? sum + row.duplicates : sum), 0)
            : 0;
        const showDuplicates = dedupStrategy !== LogsDedupStrategy.none && dedupCount > 0;
        // Staged rendering
        const processedRows = dedupedRows ? dedupedRows : [];
        const orderedRows = logsSortOrder ? this.sortLogs(processedRows, logsSortOrder) : processedRows;
        const firstRows = orderedRows.slice(0, previewLimit);
        const lastRows = orderedRows.slice(previewLimit, orderedRows.length);
        // React profiler becomes unusable if we pass all rows to all rows and their labels, using getter instead
        const getRows = this.makeGetRows(orderedRows);
        const keyMaker = new UniqueKeyMaker();
        return (React.createElement("table", { className: cx(styles.logsRowsTable, this.props.overflowingContent ? '' : styles.logsRowsTableContain) },
            React.createElement("tbody", null,
                hasData &&
                    firstRows.map((row) => (React.createElement(LogRow, Object.assign({ key: keyMaker.getKey(row.uid), getRows: getRows, row: row, showDuplicates: showDuplicates, logsSortOrder: logsSortOrder, onOpenContext: this.openContext, styles: styles, onPermalinkClick: this.props.onPermalinkClick, scrollIntoView: this.props.scrollIntoView, permalinkedRowId: this.props.permalinkedRowId, onPinLine: this.props.onPinLine, onUnpinLine: this.props.onUnpinLine, pinned: this.props.pinnedRowId === row.uid, isFilterLabelActive: this.props.isFilterLabelActive }, rest)))),
                hasData &&
                    renderAll &&
                    lastRows.map((row) => (React.createElement(LogRow, Object.assign({ key: keyMaker.getKey(row.uid), getRows: getRows, row: row, showDuplicates: showDuplicates, logsSortOrder: logsSortOrder, onOpenContext: this.openContext, styles: styles, onPermalinkClick: this.props.onPermalinkClick, scrollIntoView: this.props.scrollIntoView, permalinkedRowId: this.props.permalinkedRowId, onPinLine: this.props.onPinLine, onUnpinLine: this.props.onUnpinLine, pinned: this.props.pinnedRowId === row.uid, isFilterLabelActive: this.props.isFilterLabelActive }, rest)))),
                hasData && !renderAll && (React.createElement("tr", null,
                    React.createElement("td", { colSpan: 5 },
                        "Rendering ",
                        orderedRows.length - previewLimit,
                        " rows..."))))));
    }
}
UnThemedLogRows.defaultProps = {
    previewLimit: PREVIEW_LIMIT,
};
export const LogRows = withTheme2(UnThemedLogRows);
LogRows.displayName = 'LogsRows';
//# sourceMappingURL=LogRows.js.map