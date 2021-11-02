import { __assign, __makeTemplateObject } from "tslib";
import React, { useEffect, useMemo } from 'react';
import { Modal, Button, Form, Field, Input, useStyles2 } from '@grafana/ui';
import { durationValidationPattern } from '../../utils/time';
import { css } from '@emotion/css';
import { useDispatch } from 'react-redux';
import { updateLotexNamespaceAndGroupAction } from '../../state/actions';
import { getRulesSourceName } from '../../utils/datasource';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { initialAsyncRequestState } from '../../utils/redux';
import { useCleanup } from 'app/core/hooks/useCleanup';
export function EditCloudGroupModal(props) {
    var _a;
    var namespace = props.namespace, group = props.group, onClose = props.onClose;
    var styles = useStyles2(getStyles);
    var dispatch = useDispatch();
    var _b = (_a = useUnifiedAlertingSelector(function (state) { return state.updateLotexNamespaceAndGroup; })) !== null && _a !== void 0 ? _a : initialAsyncRequestState, loading = _b.loading, error = _b.error, dispatched = _b.dispatched;
    var defaultValues = useMemo(function () {
        var _a;
        return ({
            namespaceName: namespace.name,
            groupName: group.name,
            groupInterval: (_a = group.interval) !== null && _a !== void 0 ? _a : '',
        });
    }, [namespace, group]);
    // close modal if successfully saved
    useEffect(function () {
        if (dispatched && !loading && !error) {
            onClose();
        }
    }, [dispatched, loading, onClose, error]);
    useCleanup(function (state) { return state.unifiedAlerting.updateLotexNamespaceAndGroup; });
    var onSubmit = function (values) {
        dispatch(updateLotexNamespaceAndGroupAction({
            rulesSourceName: getRulesSourceName(namespace.rulesSource),
            groupName: group.name,
            newGroupName: values.groupName,
            namespaceName: namespace.name,
            newNamespaceName: values.namespaceName,
            groupInterval: values.groupInterval || undefined,
        }));
    };
    return (React.createElement(Modal, { className: styles.modal, isOpen: true, title: "Edit namespace or rule group", onDismiss: onClose, onClickBackdrop: onClose },
        React.createElement(Form, { defaultValues: defaultValues, onSubmit: onSubmit, key: JSON.stringify(defaultValues) }, function (_a) {
            var _b, _c, _d;
            var register = _a.register, errors = _a.errors, isDirty = _a.formState.isDirty;
            return (React.createElement(React.Fragment, null,
                React.createElement(Field, { label: "Namespace", invalid: !!errors.namespaceName, error: (_b = errors.namespaceName) === null || _b === void 0 ? void 0 : _b.message },
                    React.createElement(Input, __assign({ id: "namespaceName" }, register('namespaceName', {
                        required: 'Namespace name is required.',
                    })))),
                React.createElement(Field, { label: "Rule group", invalid: !!errors.groupName, error: (_c = errors.groupName) === null || _c === void 0 ? void 0 : _c.message },
                    React.createElement(Input, __assign({ id: "groupName" }, register('groupName', {
                        required: 'Rule group name is required.',
                    })))),
                React.createElement(Field, { label: "Rule group evaluation interval", invalid: !!errors.groupInterval, error: (_d = errors.groupInterval) === null || _d === void 0 ? void 0 : _d.message },
                    React.createElement(Input, __assign({ id: "groupInterval", placeholder: "1m" }, register('groupInterval', {
                        pattern: durationValidationPattern,
                    })))),
                React.createElement(Modal.ButtonRow, null,
                    React.createElement(Button, { variant: "secondary", type: "button", disabled: loading, onClick: onClose, fill: "outline" }, "Close"),
                    React.createElement(Button, { type: "submit", disabled: !isDirty || loading }, loading ? 'Saving...' : 'Save changes'))));
        })));
}
var getStyles = function () { return ({
    modal: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    max-width: 560px;\n  "], ["\n    max-width: 560px;\n  "]))),
}); };
var templateObject_1;
//# sourceMappingURL=EditCloudGroupModal.js.map