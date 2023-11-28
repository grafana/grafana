export function setKustoQuery(query, kustoQuery) {
    return Object.assign(Object.assign({}, query), { azureLogAnalytics: Object.assign(Object.assign({}, query.azureLogAnalytics), { query: kustoQuery }) });
}
export function setFormatAs(query, formatAs) {
    return Object.assign(Object.assign({}, query), { azureLogAnalytics: Object.assign(Object.assign({}, query.azureLogAnalytics), { resultFormat: formatAs }) });
}
export function setDashboardTime(query, dashboardTime) {
    return Object.assign(Object.assign({}, query), { azureLogAnalytics: Object.assign(Object.assign({}, query.azureLogAnalytics), { dashboardTime }) });
}
export function setTimeColumn(query, timeColumn) {
    return Object.assign(Object.assign({}, query), { azureLogAnalytics: Object.assign(Object.assign({}, query.azureLogAnalytics), { timeColumn }) });
}
//# sourceMappingURL=setQueryValue.js.map