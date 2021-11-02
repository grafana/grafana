import React from 'react';
import { SELECT_WIDTH } from '../constants';
import { AlignmentFunction, AlignmentPeriod, AlignmentPeriodLabel, QueryEditorField, QueryEditorRow } from '.';
export var Alignment = function (_a) {
    var templateVariableOptions = _a.templateVariableOptions, onChange = _a.onChange, query = _a.query, customMetaData = _a.customMetaData, datasource = _a.datasource;
    return (React.createElement(QueryEditorRow, { label: "Alignment function", tooltip: "The process of alignment consists of collecting all data points received in a fixed length of time, applying a function to combine those data points, and assigning a timestamp to the result.", fillComponent: React.createElement(AlignmentPeriodLabel, { datasource: datasource, customMetaData: customMetaData }) },
        React.createElement(AlignmentFunction, { templateVariableOptions: templateVariableOptions, query: query, onChange: onChange }),
        React.createElement(QueryEditorField, { label: "Alignment period" },
            React.createElement(AlignmentPeriod, { selectWidth: SELECT_WIDTH, templateVariableOptions: templateVariableOptions, query: query, onChange: onChange }))));
};
//# sourceMappingURL=Alignment.js.map