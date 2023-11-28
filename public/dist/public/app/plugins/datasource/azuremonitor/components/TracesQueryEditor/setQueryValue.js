export function setQueryOperationId(query, operationId) {
    return Object.assign(Object.assign({}, query), { azureTraces: Object.assign(Object.assign({}, query.azureTraces), { operationId }) });
}
export function setFormatAs(query, formatAs) {
    return Object.assign(Object.assign({}, query), { azureTraces: Object.assign(Object.assign({}, query.azureTraces), { resultFormat: formatAs }) });
}
export function setTraceTypes(query, traceTypes) {
    return Object.assign(Object.assign({}, query), { azureTraces: Object.assign(Object.assign({}, query.azureTraces), { traceTypes }) });
}
export function setFilters(query, filters) {
    return Object.assign(Object.assign({}, query), { azureTraces: Object.assign(Object.assign({}, query.azureTraces), { filters }) });
}
//# sourceMappingURL=setQueryValue.js.map