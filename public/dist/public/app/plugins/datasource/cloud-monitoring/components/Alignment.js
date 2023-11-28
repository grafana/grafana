import React, { useMemo } from 'react';
import { EditorField, EditorFieldGroup } from '@grafana/experimental';
import { ALIGNMENT_PERIODS } from '../constants';
import { alignmentPeriodLabel } from '../functions';
import { AlignmentFunction } from './AlignmentFunction';
import { PeriodSelect } from './PeriodSelect';
export const Alignment = ({ refId, templateVariableOptions, onChange, query, customMetaData, datasource, metricDescriptor, preprocessor, }) => {
    const alignmentLabel = useMemo(() => alignmentPeriodLabel(customMetaData, datasource), [customMetaData, datasource]);
    return (React.createElement(EditorFieldGroup, null,
        React.createElement(EditorField, { label: "Alignment function", tooltip: "The process of alignment consists of collecting all data points received in a fixed length of time, applying a function to combine those data points, and assigning a timestamp to the result." },
            React.createElement(AlignmentFunction, { inputId: `${refId}-alignment-function`, templateVariableOptions: templateVariableOptions, query: query, onChange: (q) => onChange(Object.assign(Object.assign({}, query), q)), metricDescriptor: metricDescriptor, preprocessor: preprocessor })),
        React.createElement(EditorField, { label: "Alignment period", tooltip: alignmentLabel },
            React.createElement(PeriodSelect, { inputId: `${refId}-alignment-period`, templateVariableOptions: templateVariableOptions, current: query.alignmentPeriod, onChange: (period) => onChange(Object.assign(Object.assign({}, query), { alignmentPeriod: period })), aligmentPeriods: ALIGNMENT_PERIODS }))));
};
//# sourceMappingURL=Alignment.js.map