import { css, cx } from '@emotion/css';
import { isEqual, pickBy } from 'lodash';
import React, { useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useDebounce } from 'react-use';
import { addDurationToDate, dateTime, DefaultTimeZone, intervalToAbbreviatedDurationString, isValidDate, parseDuration, } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Button, Field, FieldSet, Input, LinkButton, TextArea, useStyles2 } from '@grafana/ui';
import { useCleanup } from 'app/core/hooks/useCleanup';
import { MatcherOperator } from 'app/plugins/datasource/alertmanager/types';
import { useDispatch } from 'app/types';
import { useURLSearchParams } from '../../hooks/useURLSearchParams';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { createOrUpdateSilenceAction } from '../../state/actions';
import { matcherFieldToMatcher, matcherToMatcherField } from '../../utils/alertmanager';
import { parseQueryParamMatchers } from '../../utils/matchers';
import { makeAMLink } from '../../utils/misc';
import { initialAsyncRequestState } from '../../utils/redux';
import MatchersField from './MatchersField';
import { SilencePeriod } from './SilencePeriod';
import { SilencedInstancesPreview } from './SilencedInstancesPreview';
const defaultsFromQuery = (searchParams) => {
    const defaults = {};
    const comment = searchParams.get('comment');
    const matchers = searchParams.getAll('matcher');
    const formMatchers = parseQueryParamMatchers(matchers);
    if (formMatchers.length) {
        defaults.matchers = formMatchers.map(matcherToMatcherField);
    }
    if (comment) {
        defaults.comment = comment;
    }
    return defaults;
};
const getDefaultFormValues = (searchParams, silence) => {
    var _a;
    const now = new Date();
    if (silence) {
        const isExpired = Date.parse(silence.endsAt) < Date.now();
        const interval = isExpired
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
        const endsAt = addDurationToDate(now, { hours: 2 }); // Default time period is now + 2h
        return Object.assign({ id: '', startsAt: now.toISOString(), endsAt: endsAt.toISOString(), comment: `created ${dateTime().format('YYYY-MM-DD HH:mm')}`, createdBy: config.bootData.user.name, duration: '2h', isRegex: false, matchers: [{ name: '', value: '', operator: MatcherOperator.equal }], matcherName: '', matcherValue: '', timeZone: DefaultTimeZone }, defaultsFromQuery(searchParams));
    }
};
export const SilencesEditor = ({ silence, alertManagerSourceName }) => {
    var _a, _b;
    const [urlSearchParams] = useURLSearchParams();
    const defaultValues = useMemo(() => getDefaultFormValues(urlSearchParams, silence), [silence, urlSearchParams]);
    const formAPI = useForm({ defaultValues });
    const dispatch = useDispatch();
    const styles = useStyles2(getStyles);
    const [matchersForPreview, setMatchersForPreview] = useState(defaultValues.matchers.map(matcherFieldToMatcher));
    const { loading } = useUnifiedAlertingSelector((state) => state.updateSilence);
    useCleanup((state) => (state.unifiedAlerting.updateSilence = initialAsyncRequestState));
    const { register, handleSubmit, formState, watch, setValue, clearErrors } = formAPI;
    const onSubmit = (data) => {
        const { id, startsAt, endsAt, comment, createdBy, matchers: matchersFields } = data;
        const matchers = matchersFields.map(matcherFieldToMatcher);
        const payload = pickBy({
            id,
            startsAt,
            endsAt,
            comment,
            createdBy,
            matchers,
        }, (value) => !!value);
        dispatch(createOrUpdateSilenceAction({
            alertManagerSourceName,
            payload,
            exitOnSave: true,
            successMessage: `Silence ${payload.id ? 'updated' : 'created'}`,
        }));
    };
    const duration = watch('duration');
    const startsAt = watch('startsAt');
    const endsAt = watch('endsAt');
    const matcherFields = watch('matchers');
    // Keep duration and endsAt in sync
    const [prevDuration, setPrevDuration] = useState(duration);
    useDebounce(() => {
        if (isValidDate(startsAt) && isValidDate(endsAt)) {
            if (duration !== prevDuration) {
                setValue('endsAt', dateTime(addDurationToDate(new Date(startsAt), parseDuration(duration))).toISOString());
                setPrevDuration(duration);
            }
            else {
                const startValue = new Date(startsAt).valueOf();
                const endValue = new Date(endsAt).valueOf();
                if (endValue > startValue) {
                    const nextDuration = intervalToAbbreviatedDurationString({
                        start: new Date(startsAt),
                        end: new Date(endsAt),
                    });
                    setValue('duration', nextDuration);
                    setPrevDuration(nextDuration);
                }
            }
        }
    }, 700, [clearErrors, duration, endsAt, prevDuration, setValue, startsAt]);
    useDebounce(() => {
        // React-hook-form watch does not return referentialy equal values so this trick is needed
        const newMatchers = matcherFields.filter((m) => m.name && m.value).map(matcherFieldToMatcher);
        if (!isEqual(matchersForPreview, newMatchers)) {
            setMatchersForPreview(newMatchers);
        }
    }, 700, [matcherFields]);
    const userLogged = Boolean(config.bootData.user.isSignedIn && config.bootData.user.name);
    return (React.createElement(FormProvider, Object.assign({}, formAPI),
        React.createElement("form", { onSubmit: handleSubmit(onSubmit) },
            React.createElement(FieldSet, { label: `${silence ? 'Recreate silence' : 'Create silence'}` },
                React.createElement("div", { className: cx(styles.flexRow, styles.silencePeriod) },
                    React.createElement(SilencePeriod, null),
                    React.createElement(Field, { label: "Duration", invalid: !!formState.errors.duration, error: formState.errors.duration &&
                            (formState.errors.duration.type === 'required' ? 'Required field' : formState.errors.duration.message) },
                        React.createElement(Input, Object.assign({ className: styles.createdBy }, register('duration', {
                            validate: (value) => Object.keys(parseDuration(value)).length === 0
                                ? 'Invalid duration. Valid example: 1d 4h (Available units: y, M, w, d, h, m, s)'
                                : undefined,
                        }), { id: "duration" })))),
                React.createElement(MatchersField, null),
                React.createElement(Field, { className: cx(styles.field, styles.textArea), label: "Comment", required: true, error: (_a = formState.errors.comment) === null || _a === void 0 ? void 0 : _a.message, invalid: !!formState.errors.comment },
                    React.createElement(TextArea, Object.assign({}, register('comment', { required: { value: true, message: 'Required.' } }), { rows: 5, placeholder: "Details about the silence" }))),
                !userLogged && (React.createElement(Field, { className: cx(styles.field, styles.createdBy), label: "Created By", required: true, error: (_b = formState.errors.createdBy) === null || _b === void 0 ? void 0 : _b.message, invalid: !!formState.errors.createdBy },
                    React.createElement(Input, Object.assign({}, register('createdBy', { required: { value: true, message: 'Required.' } }), { placeholder: "Who's creating the silence" })))),
                React.createElement(SilencedInstancesPreview, { amSourceName: alertManagerSourceName, matchers: matchersForPreview })),
            React.createElement("div", { className: styles.flexRow },
                loading && (React.createElement(Button, { disabled: true, icon: "fa fa-spinner", variant: "primary" }, "Saving...")),
                !loading && React.createElement(Button, { type: "submit" }, "Save silence"),
                React.createElement(LinkButton, { href: makeAMLink('alerting/silences', alertManagerSourceName), variant: 'secondary' }, "Cancel")))));
};
const getStyles = (theme) => ({
    field: css `
    margin: ${theme.spacing(1, 0)};
  `,
    textArea: css `
    max-width: ${theme.breakpoints.values.sm}px;
  `,
    createdBy: css `
    width: 200px;
  `,
    flexRow: css `
    display: flex;
    flex-direction: row;
    justify-content: flex-start;

    & > * {
      margin-right: ${theme.spacing(1)};
    }
  `,
    silencePeriod: css `
    max-width: ${theme.breakpoints.values.sm}px;
  `,
});
export default SilencesEditor;
//# sourceMappingURL=SilencesEditor.js.map