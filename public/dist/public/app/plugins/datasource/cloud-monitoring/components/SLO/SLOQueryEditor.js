import { __assign } from "tslib";
import React from 'react';
import { Project, AliasBy, AlignmentPeriod, AlignmentPeriodLabel, QueryEditorRow } from '..';
import { AlignmentTypes } from '../../types';
import { Selector, Service, SLO } from '.';
import { SELECT_WIDTH } from '../../constants';
export var defaultQuery = function (dataSource) { return ({
    projectName: dataSource.getDefaultProject(),
    alignmentPeriod: 'cloud-monitoring-auto',
    perSeriesAligner: AlignmentTypes.ALIGN_MEAN,
    aliasBy: '',
    selectorName: 'select_slo_health',
    serviceId: '',
    serviceName: '',
    sloId: '',
    sloName: '',
}); };
export function SLOQueryEditor(_a) {
    var query = _a.query, datasource = _a.datasource, onChange = _a.onChange, variableOptionGroup = _a.variableOptionGroup, customMetaData = _a.customMetaData;
    return (React.createElement(React.Fragment, null,
        React.createElement(Project, { templateVariableOptions: variableOptionGroup.options, projectName: query.projectName, datasource: datasource, onChange: function (projectName) { return onChange(__assign(__assign({}, query), { projectName: projectName })); } }),
        React.createElement(Service, { datasource: datasource, templateVariableOptions: variableOptionGroup.options, query: query, onChange: onChange }),
        React.createElement(SLO, { datasource: datasource, templateVariableOptions: variableOptionGroup.options, query: query, onChange: onChange }),
        React.createElement(Selector, { datasource: datasource, templateVariableOptions: variableOptionGroup.options, query: query, onChange: onChange }),
        React.createElement(QueryEditorRow, { label: "Alignment period" },
            React.createElement(AlignmentPeriod, { templateVariableOptions: variableOptionGroup.options, query: __assign(__assign({}, query), { perSeriesAligner: query.selectorName === 'select_slo_health' ? 'ALIGN_MEAN' : 'ALIGN_NEXT_OLDER' }), onChange: onChange, selectWidth: SELECT_WIDTH }),
            React.createElement(AlignmentPeriodLabel, { datasource: datasource, customMetaData: customMetaData })),
        React.createElement(AliasBy, { value: query.aliasBy, onChange: function (aliasBy) { return onChange(__assign(__assign({}, query), { aliasBy: aliasBy })); } })));
}
//# sourceMappingURL=SLOQueryEditor.js.map