import { __assign, __rest } from "tslib";
import { Field, InputControl, Select } from '@grafana/ui';
import { ExpressionDatasourceUID } from 'app/features/expressions/ExpressionDatasource';
import React, { useEffect, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
export var ConditionField = function () {
    var _a, _b;
    var _c = useFormContext(), watch = _c.watch, setValue = _c.setValue, errors = _c.formState.errors;
    var queries = watch('queries');
    var condition = watch('condition');
    var options = useMemo(function () {
        return queries
            .filter(function (q) { return !!q.refId; })
            .map(function (q) { return ({
            value: q.refId,
            label: q.refId,
        }); });
    }, [queries]);
    // reset condition if option no longer exists or if it is unset, but there are options available
    useEffect(function () {
        var expressions = queries.filter(function (query) { return query.datasourceUid === ExpressionDatasourceUID; });
        if (condition && !options.find(function (_a) {
            var value = _a.value;
            return value === condition;
        })) {
            setValue('condition', expressions.length ? expressions[expressions.length - 1].refId : null);
        }
        else if (!condition && expressions.length) {
            setValue('condition', expressions[expressions.length - 1].refId);
        }
    }, [condition, options, queries, setValue]);
    return (React.createElement(Field, { label: "Condition", description: "The query or expression that will be alerted on", error: (_a = errors.condition) === null || _a === void 0 ? void 0 : _a.message, invalid: !!((_b = errors.condition) === null || _b === void 0 ? void 0 : _b.message) },
        React.createElement(InputControl, { name: "condition", render: function (_a) {
                var _b = _a.field, onChange = _b.onChange, ref = _b.ref, field = __rest(_b, ["onChange", "ref"]);
                return (React.createElement(Select, __assign({ menuShouldPortal: true }, field, { width: 42, options: options, onChange: function (v) { var _a; return onChange((_a = v === null || v === void 0 ? void 0 : v.value) !== null && _a !== void 0 ? _a : null); }, noOptionsMessage: "No queries defined" })));
            }, rules: {
                required: {
                    value: true,
                    message: 'Please select the condition to alert on',
                },
            } })));
};
//# sourceMappingURL=ConditionField.js.map