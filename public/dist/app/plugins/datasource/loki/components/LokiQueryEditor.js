import * as tslib_1 from "tslib";
// Libraries
import React, { PureComponent } from 'react';
// interface State {
//   query: LokiQuery;
// }
var LokiQueryEditor = /** @class */ (function (_super) {
    tslib_1.__extends(LokiQueryEditor, _super);
    function LokiQueryEditor() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    // state: State = {
    //   query: this.props.query,
    // };
    //
    // onRunQuery = () => {
    //   const { query } = this.state;
    //
    //   this.props.onChange(query);
    //   this.props.onRunQuery();
    // };
    //
    // onFieldChange = (query: LokiQuery, override?) => {
    //   this.setState({
    //     query: {
    //       ...this.state.query,
    //       expr: query.expr,
    //     },
    //   });
    // };
    //
    // onFormatChanged = (option: SelectOptionItem) => {
    //   this.props.onChange({
    //     ...this.state.query,
    //     resultFormat: option.value,
    //   });
    // };
    LokiQueryEditor.prototype.render = function () {
        // const { query } = this.state;
        // const { datasource } = this.props;
        // const formatOptions: SelectOptionItem[] = [
        //   { label: 'Time Series', value: 'time_series' },
        //   { label: 'Table', value: 'table' },
        // ];
        //
        // query.resultFormat = query.resultFormat || 'time_series';
        // const currentFormat = formatOptions.find(item => item.value === query.resultFormat);
        return (React.createElement("div", null,
            React.createElement("div", { className: "gf-form" },
                React.createElement("div", { className: "gf-form-label" }, "Loki is currently not supported as dashboard data source. We are working on it!"))));
    };
    return LokiQueryEditor;
}(PureComponent));
export { LokiQueryEditor };
export default LokiQueryEditor;
//# sourceMappingURL=LokiQueryEditor.js.map