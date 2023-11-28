import React from 'react';
import { connect } from 'react-redux';
import { Alert } from '@grafana/ui';
import { resetError, resetWarning } from './state/reducers';
function mapStateToProps(state) {
    return {
        error: state.authConfig.updateError,
        warning: state.authConfig.warning,
    };
}
const mapDispatchToProps = {
    resetError,
    resetWarning,
};
const connector = connect(mapStateToProps, mapDispatchToProps);
export const ErrorContainerUnconnected = ({ error, warning, resetError, resetWarning }) => {
    var _a, _b;
    return (React.createElement("div", null,
        error && (React.createElement(Alert, { title: error.message, onRemove: () => resetError() }, (_a = error.errors) === null || _a === void 0 ? void 0 : _a.map((e, i) => React.createElement("div", { key: i }, e)))),
        warning && (React.createElement(Alert, { title: warning.message, onRemove: () => resetWarning(), severity: "warning" }, (_b = warning.errors) === null || _b === void 0 ? void 0 : _b.map((e, i) => React.createElement("div", { key: i }, e))))));
};
export default connector(ErrorContainerUnconnected);
//# sourceMappingURL=ErrorContainer.js.map