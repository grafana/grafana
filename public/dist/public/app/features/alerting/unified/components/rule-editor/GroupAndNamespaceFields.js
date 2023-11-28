import { __rest } from "tslib";
import { css } from '@emotion/css';
import React, { useEffect, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { Field, InputControl, useStyles2, VirtualizedSelect } from '@grafana/ui';
import { useDispatch } from 'app/types';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { fetchRulerRulesAction } from '../../state/actions';
import { checkForPathSeparator } from './util';
export const GroupAndNamespaceFields = ({ rulesSourceName }) => {
    var _a, _b, _c, _d, _e;
    const { control, watch, formState: { errors }, setValue, } = useFormContext();
    const style = useStyles2(getStyle);
    const rulerRequests = useUnifiedAlertingSelector((state) => state.rulerRules);
    const dispatch = useDispatch();
    useEffect(() => {
        dispatch(fetchRulerRulesAction({ rulesSourceName }));
    }, [rulesSourceName, dispatch]);
    const rulesConfig = (_a = rulerRequests[rulesSourceName]) === null || _a === void 0 ? void 0 : _a.result;
    const namespace = watch('namespace');
    const namespaceOptions = useMemo(() => rulesConfig ? Object.keys(rulesConfig).map((namespace) => ({ label: namespace, value: namespace })) : [], [rulesConfig]);
    const groupOptions = useMemo(() => { var _a; return (namespace && ((_a = rulesConfig === null || rulesConfig === void 0 ? void 0 : rulesConfig[namespace]) === null || _a === void 0 ? void 0 : _a.map((group) => ({ label: group.name, value: group.name })))) || []; }, [namespace, rulesConfig]);
    return (React.createElement("div", { className: style.flexRow },
        React.createElement(Field, { "data-testid": "namespace-picker", label: "Namespace", error: (_b = errors.namespace) === null || _b === void 0 ? void 0 : _b.message, invalid: !!((_c = errors.namespace) === null || _c === void 0 ? void 0 : _c.message) },
            React.createElement(InputControl, { render: (_a) => {
                    var _b = _a.field, { onChange, ref } = _b, field = __rest(_b, ["onChange", "ref"]);
                    return (React.createElement(VirtualizedSelect, Object.assign({}, field, { allowCustomValue: true, className: style.input, onChange: (value) => {
                            setValue('group', ''); //reset if namespace changes
                            onChange(value.value);
                        }, options: namespaceOptions, width: 42 })));
                }, name: "namespace", control: control, rules: {
                    required: { value: true, message: 'Required.' },
                    validate: {
                        pathSeparator: checkForPathSeparator,
                    },
                } })),
        React.createElement(Field, { "data-testid": "group-picker", label: "Group", error: (_d = errors.group) === null || _d === void 0 ? void 0 : _d.message, invalid: !!((_e = errors.group) === null || _e === void 0 ? void 0 : _e.message) },
            React.createElement(InputControl, { render: (_a) => {
                    var _b = _a.field, { ref } = _b, field = __rest(_b, ["ref"]);
                    return (React.createElement(VirtualizedSelect, Object.assign({}, field, { allowCustomValue: true, options: groupOptions, width: 42, onChange: (value) => {
                            var _a;
                            setValue('group', (_a = value.value) !== null && _a !== void 0 ? _a : '');
                        }, className: style.input })));
                }, name: "group", control: control, rules: {
                    required: { value: true, message: 'Required.' },
                    validate: {
                        pathSeparator: checkForPathSeparator,
                    },
                } }))));
};
const getStyle = (theme) => ({
    flexRow: css `
    display: flex;
    flex-direction: row;
    justify-content: flex-start;

    & > * + * {
      margin-left: ${theme.spacing(3)};
    }
  `,
    input: css `
    width: 330px !important;
  `,
});
//# sourceMappingURL=GroupAndNamespaceFields.js.map