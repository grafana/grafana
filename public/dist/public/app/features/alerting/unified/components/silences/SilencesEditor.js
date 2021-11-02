import { __assign, __makeTemplateObject, __read } from "tslib";
import { MatcherOperator } from 'app/plugins/datasource/alertmanager/types';
import React, { useMemo, useState } from 'react';
import { Button, Field, FieldSet, Input, LinkButton, TextArea, useStyles2 } from '@grafana/ui';
import { DefaultTimeZone, parseDuration, intervalToAbbreviatedDurationString, addDurationToDate, dateTime, isValidDate, } from '@grafana/data';
import { useDebounce } from 'react-use';
import { config } from '@grafana/runtime';
import { pickBy } from 'lodash';
import MatchersField from './MatchersField';
import { useForm, FormProvider } from 'react-hook-form';
import { useDispatch } from 'react-redux';
import { createOrUpdateSilenceAction } from '../../state/actions';
import { SilencePeriod } from './SilencePeriod';
import { css, cx } from '@emotion/css';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { makeAMLink } from '../../utils/misc';
import { useCleanup } from 'app/core/hooks/useCleanup';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { parseQueryParamMatchers } from '../../utils/matchers';
import { matcherToMatcherField, matcherFieldToMatcher } from '../../utils/alertmanager';
var defaultsFromQuery = function (queryParams) {
    var defaults = {};
    var matchers = queryParams.matchers, comment = queryParams.comment;
    if (typeof matchers === 'string') {
        var formMatchers = parseQueryParamMatchers(matchers);
        if (formMatchers.length) {
            defaults.matchers = formMatchers.map(matcherToMatcherField);
        }
    }
    if (typeof comment === 'string') {
        defaults.comment = comment;
    }
    return defaults;
};
var getDefaultFormValues = function (queryParams, silence) {
    var _a;
    var now = new Date();
    if (silence) {
        var isExpired = Date.parse(silence.endsAt) < Date.now();
        var interval = isExpired
            ? {
                start: now,
                end: addDurationToDate(now, { hours: 2 }),
            }
            : { start: new Date(silence.startsAt), end: new Date(silence.endsAt) };
        return {
            id: silence.id,
            startsAt: interval.start.toISOString(),
            endsAt: interval.end.toISOString(),
            comment: silence.comment,
            createdBy: silence.createdBy,
            duration: intervalToAbbreviatedDurationString(interval),
            isRegex: false,
            matchers: ((_a = silence.matchers) === null || _a === void 0 ? void 0 : _a.map(matcherToMatcherField)) || [],
            matcherName: '',
            matcherValue: '',
            timeZone: DefaultTimeZone,
        };
    }
    else {
        var endsAt = addDurationToDate(now, { hours: 2 }); // Default time period is now + 2h
        return __assign({ id: '', startsAt: now.toISOString(), endsAt: endsAt.toISOString(), comment: '', createdBy: config.bootData.user.name, duration: '2h', isRegex: false, matchers: [{ name: '', value: '', operator: MatcherOperator.equal }], matcherName: '', matcherValue: '', timeZone: DefaultTimeZone }, defaultsFromQuery(queryParams));
    }
};
export var SilencesEditor = function (_a) {
    var _b, _c;
    var silence = _a.silence, alertManagerSourceName = _a.alertManagerSourceName;
    var _d = __read(useQueryParams(), 1), queryParams = _d[0];
    var defaultValues = useMemo(function () { return getDefaultFormValues(queryParams, silence); }, [silence, queryParams]);
    var formAPI = useForm({ defaultValues: defaultValues });
    var dispatch = useDispatch();
    var styles = useStyles2(getStyles);
    var loading = useUnifiedAlertingSelector(function (state) { return state.updateSilence; }).loading;
    useCleanup(function (state) { return state.unifiedAlerting.updateSilence; });
    var register = formAPI.register, handleSubmit = formAPI.handleSubmit, formState = formAPI.formState, watch = formAPI.watch, setValue = formAPI.setValue, clearErrors = formAPI.clearErrors;
    var onSubmit = function (data) {
        var id = data.id, startsAt = data.startsAt, endsAt = data.endsAt, comment = data.comment, createdBy = data.createdBy, matchersFields = data.matchers;
        var matchers = matchersFields.map(matcherFieldToMatcher);
        var payload = pickBy({
            id: id,
            startsAt: startsAt,
            endsAt: endsAt,
            comment: comment,
            createdBy: createdBy,
            matchers: matchers,
        }, function (value) { return !!value; });
        dispatch(createOrUpdateSilenceAction({
            alertManagerSourceName: alertManagerSourceName,
            payload: payload,
            exitOnSave: true,
            successMessage: "Silence " + (payload.id ? 'updated' : 'created'),
        }));
    };
    var duration = watch('duration');
    var startsAt = watch('startsAt');
    var endsAt = watch('endsAt');
    // Keep duration and endsAt in sync
    var _e = __read(useState(duration), 2), prevDuration = _e[0], setPrevDuration = _e[1];
    useDebounce(function () {
        if (isValidDate(startsAt) && isValidDate(endsAt)) {
            if (duration !== prevDuration) {
                setValue('endsAt', dateTime(addDurationToDate(new Date(startsAt), parseDuration(duration))).toISOString());
                setPrevDuration(duration);
            }
            else {
                var startValue = new Date(startsAt).valueOf();
                var endValue = new Date(endsAt).valueOf();
                if (endValue > startValue) {
                    var nextDuration = intervalToAbbreviatedDurationString({
                        start: new Date(startsAt),
                        end: new Date(endsAt),
                    });
                    setValue('duration', nextDuration);
                    setPrevDuration(nextDuration);
                }
            }
        }
    }, 700, [clearErrors, duration, endsAt, prevDuration, setValue, startsAt]);
    return (React.createElement(FormProvider, __assign({}, formAPI),
        React.createElement("form", { onSubmit: handleSubmit(onSubmit) },
            React.createElement(FieldSet, { label: "" + (silence ? 'Recreate silence' : 'Create silence') },
                React.createElement("div", { className: styles.flexRow },
                    React.createElement(SilencePeriod, null),
                    React.createElement(Field, { label: "Duration", invalid: !!formState.errors.duration, error: formState.errors.duration &&
                            (formState.errors.duration.type === 'required' ? 'Required field' : formState.errors.duration.message) },
                        React.createElement(Input, __assign({ className: styles.createdBy }, register('duration', {
                            validate: function (value) {
                                return Object.keys(parseDuration(value)).length === 0
                                    ? 'Invalid duration. Valid example: 1d 4h (Available units: y, M, w, d, h, m, s)'
                                    : undefined;
                            },
                        }), { id: "duration" })))),
                React.createElement(MatchersField, null),
                React.createElement(Field, { className: cx(styles.field, styles.textArea), label: "Comment", required: true, error: (_b = formState.errors.comment) === null || _b === void 0 ? void 0 : _b.message, invalid: !!formState.errors.comment },
                    React.createElement(TextArea, __assign({}, register('comment', { required: { value: true, message: 'Required.' } }), { placeholder: "Details about the silence" }))),
                React.createElement(Field, { className: cx(styles.field, styles.createdBy), label: "Created by", required: true, error: (_c = formState.errors.createdBy) === null || _c === void 0 ? void 0 : _c.message, invalid: !!formState.errors.createdBy },
                    React.createElement(Input, __assign({}, register('createdBy', { required: { value: true, message: 'Required.' } }), { placeholder: "User" })))),
            React.createElement("div", { className: styles.flexRow },
                loading && (React.createElement(Button, { disabled: true, icon: "fa fa-spinner", variant: "primary" }, "Saving...")),
                !loading && React.createElement(Button, { type: "submit" }, "Submit"),
                React.createElement(LinkButton, { href: makeAMLink('alerting/silences', alertManagerSourceName), variant: 'secondary', fill: "outline" }, "Cancel")))));
};
var getStyles = function (theme) { return ({
    field: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin: ", ";\n  "], ["\n    margin: ", ";\n  "])), theme.spacing(1, 0)),
    textArea: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    width: 600px;\n  "], ["\n    width: 600px;\n  "]))),
    createdBy: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    width: 200px;\n  "], ["\n    width: 200px;\n  "]))),
    flexRow: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    display: flex;\n    flex-direction: row;\n    justify-content: flex-start;\n\n    & > * {\n      margin-right: ", ";\n    }\n  "], ["\n    display: flex;\n    flex-direction: row;\n    justify-content: flex-start;\n\n    & > * {\n      margin-right: ", ";\n    }\n  "])), theme.spacing(1)),
}); };
export default SilencesEditor;
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
//# sourceMappingURL=SilencesEditor.js.map