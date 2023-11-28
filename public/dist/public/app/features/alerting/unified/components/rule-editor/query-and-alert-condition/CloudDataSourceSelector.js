import { __rest } from "tslib";
import { css } from '@emotion/css';
import React from 'react';
import { useFormContext } from 'react-hook-form';
import { Field, InputControl, useStyles2 } from '@grafana/ui';
import { RuleFormType } from '../../../types/rule-form';
import { CloudRulesSourcePicker } from '../CloudRulesSourcePicker';
export const CloudDataSourceSelector = ({ disabled, onChangeCloudDatasource }) => {
    var _a, _b;
    const { control, formState: { errors }, setValue, watch, } = useFormContext();
    const styles = useStyles2(getStyles);
    const ruleFormType = watch('type');
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: styles.flexRow }, (ruleFormType === RuleFormType.cloudAlerting || ruleFormType === RuleFormType.cloudRecording) && (React.createElement(Field, { className: styles.formInput, label: disabled ? 'Data source' : 'Select data source', error: (_a = errors.dataSourceName) === null || _a === void 0 ? void 0 : _a.message, invalid: !!((_b = errors.dataSourceName) === null || _b === void 0 ? void 0 : _b.message), "data-testid": "datasource-picker" },
            React.createElement(InputControl, { render: (_a) => {
                    var _b = _a.field, { onChange, ref } = _b, field = __rest(_b, ["onChange", "ref"]);
                    return (React.createElement(CloudRulesSourcePicker, Object.assign({}, field, { disabled: disabled, onChange: (ds) => {
                            var _a, _b;
                            // reset location if switching data sources, as different rules source will have different groups and namespaces
                            setValue('location', undefined);
                            // reset expression as they don't need to persist after changing datasources
                            setValue('expression', '');
                            onChange((_a = ds === null || ds === void 0 ? void 0 : ds.name) !== null && _a !== void 0 ? _a : null);
                            onChangeCloudDatasource((_b = ds === null || ds === void 0 ? void 0 : ds.uid) !== null && _b !== void 0 ? _b : null);
                        } })));
                }, name: "dataSourceName", control: control, rules: {
                    required: { value: true, message: 'Please select a data source' },
                } }))))));
};
const getStyles = (theme) => ({
    formInput: css `
    width: 330px;
    & + & {
      margin-left: ${theme.spacing(3)};
    }
  `,
    flexRow: css `
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    align-items: flex-end;
  `,
});
//# sourceMappingURL=CloudDataSourceSelector.js.map