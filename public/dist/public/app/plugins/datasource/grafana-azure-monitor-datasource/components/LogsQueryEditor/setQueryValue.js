import { __assign } from "tslib";
export function setKustoQuery(query, kustoQuery) {
    return __assign(__assign({}, query), { azureLogAnalytics: __assign(__assign({}, query.azureLogAnalytics), { query: kustoQuery }) });
}
export function setFormatAs(query, formatAs) {
    return __assign(__assign({}, query), { azureLogAnalytics: __assign(__assign({}, query.azureLogAnalytics), { resultFormat: formatAs }) });
}
export function setResource(query, resourceURI) {
    return __assign(__assign({}, query), { azureLogAnalytics: __assign(__assign({}, query.azureLogAnalytics), { resource: resourceURI }) });
}
//# sourceMappingURL=setQueryValue.js.map