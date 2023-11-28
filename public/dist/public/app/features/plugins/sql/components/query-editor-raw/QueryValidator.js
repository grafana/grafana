import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { useState, useMemo, useEffect } from 'react';
import { useAsyncFn } from 'react-use';
import useDebounce from 'react-use/lib/useDebounce';
import { formattedValueToString, getValueFormat } from '@grafana/data';
import { Icon, Spinner, useTheme2 } from '@grafana/ui';
export function QueryValidator({ db, query, onValidate, range }) {
    var _a;
    const [validationResult, setValidationResult] = useState();
    const theme = useTheme2();
    const valueFormatter = useMemo(() => getValueFormat('bytes'), []);
    const styles = useMemo(() => {
        return {
            error: css `
        color: ${theme.colors.error.text};
        font-size: ${theme.typography.bodySmall.fontSize};
        font-family: ${theme.typography.fontFamilyMonospace};
      `,
            valid: css `
        color: ${theme.colors.success.text};
      `,
            info: css `
        color: ${theme.colors.text.secondary};
      `,
        };
    }, [theme]);
    const [state, validateQuery] = useAsyncFn((q) => __awaiter(this, void 0, void 0, function* () {
        var _b;
        if (((_b = q.rawSql) === null || _b === void 0 ? void 0 : _b.trim()) === '') {
            return null;
        }
        return yield db.validateQuery(q, range);
    }), [db]);
    const [,] = useDebounce(() => __awaiter(this, void 0, void 0, function* () {
        const result = yield validateQuery(query);
        if (result) {
            setValidationResult(result);
        }
        return null;
    }), 1000, [query, validateQuery]);
    useEffect(() => {
        if (validationResult === null || validationResult === void 0 ? void 0 : validationResult.isError) {
            onValidate(false);
        }
        if (validationResult === null || validationResult === void 0 ? void 0 : validationResult.isValid) {
            onValidate(true);
        }
    }, [validationResult, onValidate]);
    if (!state.value && !state.loading) {
        return null;
    }
    const error = ((_a = state.value) === null || _a === void 0 ? void 0 : _a.error) ? processErrorMessage(state.value.error) : '';
    return (React.createElement(React.Fragment, null,
        state.loading && (React.createElement("div", { className: styles.info },
            React.createElement(Spinner, { inline: true, size: 12 }),
            " Validating query...")),
        !state.loading && state.value && (React.createElement(React.Fragment, null,
            React.createElement(React.Fragment, null, state.value.isValid && state.value.statistics && (React.createElement("div", { className: styles.valid },
                React.createElement(Icon, { name: "check" }),
                " This query will process",
                ' ',
                React.createElement("strong", null, formattedValueToString(valueFormatter(state.value.statistics.TotalBytesProcessed))),
                ' ',
                "when run."))),
            React.createElement(React.Fragment, null, state.value.isError && React.createElement("div", { className: styles.error }, error))))));
}
function processErrorMessage(error) {
    const splat = error.split(':');
    if (splat.length > 2) {
        return splat.slice(2).join(':');
    }
    return error;
}
//# sourceMappingURL=QueryValidator.js.map