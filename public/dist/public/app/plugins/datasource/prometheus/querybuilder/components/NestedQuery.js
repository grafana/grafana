import { css } from '@emotion/css';
import React from 'react';
import { toOption } from '@grafana/data';
import { EditorRows, FlexItem } from '@grafana/experimental';
import { AutoSizeInput, IconButton, Select, useStyles2 } from '@grafana/ui';
import { binaryScalarDefs } from '../binaryScalarOperations';
import { PromQueryBuilder } from './PromQueryBuilder';
export const NestedQuery = React.memo((props) => {
    const { nestedQuery, index, datasource, onChange, onRemove, onRunQuery, showExplain } = props;
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.card },
        React.createElement("div", { className: styles.header },
            React.createElement("div", { className: styles.name }, "Operator"),
            React.createElement(Select, { width: "auto", options: operators, value: toOption(nestedQuery.operator), onChange: (value) => {
                    onChange(index, Object.assign(Object.assign({}, nestedQuery), { operator: value.value }));
                } }),
            React.createElement("div", { className: styles.name }, "Vector matches"),
            React.createElement("div", { className: styles.vectorMatchWrapper },
                React.createElement(Select, { width: "auto", value: nestedQuery.vectorMatchesType || 'on', allowCustomValue: true, options: [
                        { value: 'on', label: 'on' },
                        { value: 'ignoring', label: 'ignoring' },
                    ], onChange: (val) => {
                        onChange(index, Object.assign(Object.assign({}, nestedQuery), { vectorMatchesType: val.value }));
                    } }),
                React.createElement(AutoSizeInput, { className: styles.vectorMatchInput, minWidth: 20, defaultValue: nestedQuery.vectorMatches, onCommitChange: (evt) => {
                        onChange(index, Object.assign(Object.assign({}, nestedQuery), { vectorMatches: evt.currentTarget.value, vectorMatchesType: nestedQuery.vectorMatchesType || 'on' }));
                    } })),
            React.createElement(FlexItem, { grow: 1 }),
            React.createElement(IconButton, { name: "times", size: "sm", onClick: () => onRemove(index), tooltip: "Remove match" })),
        React.createElement("div", { className: styles.body },
            React.createElement(EditorRows, null,
                React.createElement(PromQueryBuilder, { showExplain: showExplain, query: nestedQuery.query, datasource: datasource, onRunQuery: onRunQuery, onChange: (update) => {
                        onChange(index, Object.assign(Object.assign({}, nestedQuery), { query: update }));
                    } })))));
});
const operators = binaryScalarDefs.map((def) => ({ label: def.sign, value: def.sign }));
NestedQuery.displayName = 'NestedQuery';
const getStyles = (theme) => {
    return {
        card: css({
            label: 'card',
            display: 'flex',
            flexDirection: 'column',
            gap: theme.spacing(0.5),
        }),
        header: css({
            label: 'header',
            padding: theme.spacing(0.5, 0.5, 0.5, 1),
            gap: theme.spacing(1),
            display: 'flex',
            alignItems: 'center',
        }),
        name: css({
            label: 'name',
            whiteSpace: 'nowrap',
        }),
        body: css({
            label: 'body',
            paddingLeft: theme.spacing(2),
        }),
        vectorMatchInput: css({
            label: 'vectorMatchInput',
            marginLeft: -1,
        }),
        vectorMatchWrapper: css({
            label: 'vectorMatchWrapper',
            display: 'flex',
        }),
    };
};
//# sourceMappingURL=NestedQuery.js.map