import { __awaiter } from "tslib";
import { useEffect, useState } from 'react';
import { useAsyncFn, useDeepCompareEffect } from 'react-use';
import { toOption } from '@grafana/data';
import { config } from '@grafana/runtime';
import { appendTemplateVariables } from './utils/utils';
export const useRegions = (datasource) => {
    const [regionsIsLoading, setRegionsIsLoading] = useState(false);
    const [regions, setRegions] = useState([{ label: 'default', value: 'default' }]);
    useEffect(() => {
        setRegionsIsLoading(true);
        const variableOptionGroup = {
            label: 'Template Variables',
            options: datasource.getVariables().map(toOption),
        };
        datasource.resources
            .getRegions()
            .then((regions) => setRegions([...regions, variableOptionGroup]))
            .finally(() => setRegionsIsLoading(false));
    }, [datasource]);
    return [regions, regionsIsLoading];
};
export const useNamespaces = (datasource) => {
    const [namespaces, setNamespaces] = useState([]);
    useEffect(() => {
        datasource.resources.getNamespaces().then((namespaces) => {
            setNamespaces(appendTemplateVariables(datasource, namespaces));
        });
    }, [datasource]);
    return namespaces;
};
export const useMetrics = (datasource, { region, namespace, accountId }) => {
    const [metrics, setMetrics] = useState([]);
    // need to ensure dependency array below recieves the interpolated value so that the effect is triggered when a variable is changed
    if (region) {
        region = datasource.templateSrv.replace(region, {});
    }
    if (namespace) {
        namespace = datasource.templateSrv.replace(namespace, {});
    }
    if (accountId) {
        accountId = datasource.templateSrv.replace(accountId, {});
    }
    useEffect(() => {
        datasource.resources.getMetrics({ namespace, region, accountId }).then((result) => {
            setMetrics(appendTemplateVariables(datasource, result));
        });
    }, [datasource, region, namespace, accountId]);
    return metrics;
};
export const useDimensionKeys = (datasource, { region, namespace, metricName, dimensionFilters, accountId }) => {
    const [dimensionKeys, setDimensionKeys] = useState([]);
    // need to ensure dependency array below revieves the interpolated value so that the effect is triggered when a variable is changed
    if (region) {
        region = datasource.templateSrv.replace(region, {});
    }
    if (namespace) {
        namespace = datasource.templateSrv.replace(namespace, {});
    }
    if (metricName) {
        metricName = datasource.templateSrv.replace(metricName, {});
    }
    if (accountId) {
        accountId = datasource.templateSrv.replace(accountId, {});
    }
    if (dimensionFilters) {
        dimensionFilters = datasource.resources.convertDimensionFormat(dimensionFilters, {});
    }
    // doing deep comparison to avoid making new api calls to list metrics unless dimension filter object props changes
    useDeepCompareEffect(() => {
        datasource.resources
            .getDimensionKeys({ namespace, region, metricName, accountId, dimensionFilters })
            .then((result) => {
            setDimensionKeys(appendTemplateVariables(datasource, result));
        });
    }, [datasource, namespace, region, metricName, accountId, dimensionFilters]);
    return dimensionKeys;
};
export const useIsMonitoringAccount = (resources, region) => {
    const [isMonitoringAccount, setIsMonitoringAccount] = useState(false);
    // we call this before the use effect to ensure dependency array below
    // receives the interpolated value so that the effect is triggered when a variable is changed
    if (region) {
        region = resources.templateSrv.replace(region, {});
    }
    useEffect(() => {
        if (config.featureToggles.cloudWatchCrossAccountQuerying) {
            resources.isMonitoringAccount(region).then((result) => setIsMonitoringAccount(result));
        }
    }, [region, resources]);
    return isMonitoringAccount;
};
export const useAccountOptions = (resources, region) => {
    var _a;
    // we call this before the use effect to ensure dependency array below
    // receives the interpolated value so that the effect is triggered when a variable is changed
    if (region) {
        region = (_a = resources === null || resources === void 0 ? void 0 : resources.templateSrv.replace(region, {})) !== null && _a !== void 0 ? _a : '';
    }
    const fetchAccountOptions = () => __awaiter(void 0, void 0, void 0, function* () {
        var _b;
        if (!config.featureToggles.cloudWatchCrossAccountQuerying) {
            return Promise.resolve([]);
        }
        const accounts = (_b = (yield (resources === null || resources === void 0 ? void 0 : resources.getAccounts({ region })))) !== null && _b !== void 0 ? _b : [];
        if (accounts.length === 0) {
            return [];
        }
        const options = accounts.map((a) => ({
            label: a.label,
            value: a.id,
            description: a.id,
        }));
        const variableOptions = (resources === null || resources === void 0 ? void 0 : resources.getVariables().map(toOption)) || [];
        const variableOptionGroup = {
            label: 'Template Variables',
            options: variableOptions,
        };
        return [...options, variableOptionGroup];
    });
    const [state, doFetch] = useAsyncFn(fetchAccountOptions, [resources, region]);
    useEffect(() => {
        doFetch();
    }, [resources, region, doFetch]);
    return state;
};
//# sourceMappingURL=hooks.js.map