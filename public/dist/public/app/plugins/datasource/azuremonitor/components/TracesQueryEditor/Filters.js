import { uniq } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { EditorList } from '@grafana/experimental';
import { Field } from '@grafana/ui';
import { makeRenderItem } from './Filter';
import { tablesSchema } from './consts';
import { setFilters } from './setQueryValue';
const Filters = ({ query, datasource, onQueryChange, variableOptionGroup, range }) => {
    var _a, _b, _c, _d;
    const { azureTraces } = query;
    const queryTraceTypes = (azureTraces === null || azureTraces === void 0 ? void 0 : azureTraces.traceTypes) ? azureTraces.traceTypes : Object.keys(tablesSchema);
    const excludedProperties = new Set([
        'customDimensions',
        'customMeasurements',
        'details',
        'duration',
        'id',
        'itemId',
        'operation_Id',
        'operation_ParentId',
        'timestamp',
    ]);
    const properties = uniq(queryTraceTypes.map((type) => Object.keys(tablesSchema[type])).flat()).filter((item) => !excludedProperties.has(item));
    const [propertyMap, setPropertyMap] = useState(new Map());
    const queryFilters = useMemo(() => { var _a, _b; return (_b = (_a = query.azureTraces) === null || _a === void 0 ? void 0 : _a.filters) !== null && _b !== void 0 ? _b : []; }, [(_a = query.azureTraces) === null || _a === void 0 ? void 0 : _a.filters]);
    const [filters, updateFilters] = useState(queryFilters);
    useEffect(() => {
        setPropertyMap(new Map());
    }, [(_b = query.azureTraces) === null || _b === void 0 ? void 0 : _b.resources, (_c = query.azureTraces) === null || _c === void 0 ? void 0 : _c.traceTypes, (_d = query.azureTraces) === null || _d === void 0 ? void 0 : _d.operationId]);
    const changedFunc = (changed) => {
        let updateQuery = false;
        const properData = changed.map((x) => {
            var _a, _b, _c;
            if (x.property !== '' && x.filters && x.filters.length > 0 && x.operation !== '') {
                updateQuery = true;
            }
            else {
                updateQuery = false;
            }
            return {
                property: (_a = x.property) !== null && _a !== void 0 ? _a : '',
                filters: (_b = x.filters) !== null && _b !== void 0 ? _b : [],
                operation: (_c = x.operation) !== null && _c !== void 0 ? _c : 'eq',
            };
        });
        updateFilters(properData);
        if (updateQuery || (queryFilters.length > 0 && properData.length === 0)) {
            onQueryChange(setFilters(query, properData));
        }
    };
    return (React.createElement(Field, { label: "Filters" },
        React.createElement(EditorList, { items: filters, onChange: changedFunc, renderItem: makeRenderItem({
                query,
                datasource,
                propertyMap,
                setPropertyMap,
                queryTraceTypes,
                properties,
                variableOptionGroup,
                range,
            }) })));
};
export default Filters;
//# sourceMappingURL=Filters.js.map