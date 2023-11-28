import React, { useMemo } from 'react';
import { EditorField, EditorFieldGroup, EditorRow } from '@grafana/experimental';
import { ALIGNMENT_PERIODS, SLO_BURN_RATE_SELECTOR_NAME } from '../constants';
import { alignmentPeriodLabel } from '../functions';
import { AlignmentTypes } from '../types/query';
import { AliasBy } from './AliasBy';
import { LookbackPeriodSelect } from './LookbackPeriodSelect';
import { PeriodSelect } from './PeriodSelect';
import { Project } from './Project';
import { SLO } from './SLO';
import { Selector } from './Selector';
import { Service } from './Service';
export const defaultQuery = (dataSource) => ({
    projectName: dataSource.getDefaultProject(),
    alignmentPeriod: 'cloud-monitoring-auto',
    perSeriesAligner: AlignmentTypes.ALIGN_MEAN,
    aliasBy: '',
    selectorName: 'select_slo_health',
    serviceId: '',
    serviceName: '',
    sloId: '',
    sloName: '',
    lookbackPeriod: '',
});
export function SLOQueryEditor({ refId, query, datasource, onChange, variableOptionGroup, customMetaData, aliasBy, onChangeAliasBy, }) {
    const alignmentLabel = useMemo(() => alignmentPeriodLabel(customMetaData, datasource), [customMetaData, datasource]);
    return (React.createElement(React.Fragment, null,
        React.createElement(EditorRow, null,
            React.createElement(Project, { refId: refId, templateVariableOptions: variableOptionGroup.options, projectName: query.projectName, datasource: datasource, onChange: (projectName) => onChange(Object.assign(Object.assign({}, query), { projectName })) }),
            React.createElement(Service, { refId: refId, datasource: datasource, templateVariableOptions: variableOptionGroup.options, query: query, onChange: onChange }),
            React.createElement(SLO, { refId: refId, datasource: datasource, templateVariableOptions: variableOptionGroup.options, query: query, onChange: onChange }),
            React.createElement(Selector, { refId: refId, datasource: datasource, templateVariableOptions: variableOptionGroup.options, query: query, onChange: onChange }),
            query.selectorName === SLO_BURN_RATE_SELECTOR_NAME && (React.createElement(LookbackPeriodSelect, { refId: refId, onChange: (lookbackPeriod) => onChange(Object.assign(Object.assign({}, query), { lookbackPeriod: lookbackPeriod })), current: query.lookbackPeriod, templateVariableOptions: variableOptionGroup.options })),
            React.createElement(EditorFieldGroup, null,
                React.createElement(EditorField, { label: "Alignment period", tooltip: alignmentLabel },
                    React.createElement(PeriodSelect, { inputId: `${refId}-alignment-period`, templateVariableOptions: variableOptionGroup.options, current: query.alignmentPeriod, onChange: (period) => onChange(Object.assign(Object.assign({}, query), { alignmentPeriod: period })), aligmentPeriods: ALIGNMENT_PERIODS }))),
            React.createElement(AliasBy, { refId: refId, value: aliasBy, onChange: onChangeAliasBy }))));
}
//# sourceMappingURL=SLOQueryEditor.js.map