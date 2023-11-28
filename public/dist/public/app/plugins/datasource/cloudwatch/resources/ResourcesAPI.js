import { __awaiter } from "tslib";
import { memoize } from 'lodash';
import { getBackendSrv, config } from '@grafana/runtime';
import { CloudWatchRequest } from '../query-runner/CloudWatchRequest';
export class ResourcesAPI extends CloudWatchRequest {
    constructor(instanceSettings, templateSrv) {
        super(instanceSettings, templateSrv);
        this.memoizedGetRequest = memoize(this.getRequest.bind(this), (path, parameters) => JSON.stringify({ path, parameters }));
    }
    getRequest(subtype, parameters) {
        return getBackendSrv().get(`/api/datasources/${this.instanceSettings.id}/resources/${subtype}`, parameters);
    }
    getExternalId() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.memoizedGetRequest('external-id').then(({ externalId }) => externalId);
        });
    }
    getAccounts({ region }) {
        return this.memoizedGetRequest('accounts', {
            region: this.templateSrv.replace(this.getActualRegion(region)),
        }).then((accounts) => accounts.map((a) => a.value));
    }
    isMonitoringAccount(region) {
        return this.getAccounts({ region })
            .then((accounts) => accounts.some((account) => account.isMonitoringAccount))
            .catch(() => false);
    }
    getRegions() {
        if (!config.featureToggles.cloudwatchNewRegionsHandler) {
            return this.memoizedGetRequest('regions').then((regions) => [
                { label: 'default', value: 'default', text: 'default' },
                ...regions.filter((r) => r.value),
            ]);
        }
        return this.memoizedGetRequest('regions').then((regions) => {
            return [
                { label: 'default', value: 'default', text: 'default' },
                ...regions.map((r) => ({
                    label: r.value.name,
                    value: r.value.name,
                    text: r.value.name,
                })),
            ].filter((r) => r.value);
        });
    }
    getNamespaces() {
        return this.memoizedGetRequest('namespaces').then((namespaces) => namespaces.map((n) => ({ label: n.value, value: n.value })));
    }
    getLogGroups(params) {
        return this.memoizedGetRequest('log-groups', Object.assign(Object.assign({}, params), { region: this.templateSrv.replace(this.getActualRegion(params.region)), accountId: this.templateSrv.replace(params.accountId), listAllLogGroups: params.listAllLogGroups ? 'true' : 'false' }));
    }
    getLogGroupFields({ region, arn, logGroupName, }) {
        return this.memoizedGetRequest('log-group-fields', {
            region: this.templateSrv.replace(this.getActualRegion(region)),
            logGroupName: this.templateSrv.replace(logGroupName, {}),
            logGroupArn: this.templateSrv.replace(arn),
        });
    }
    getMetrics({ region, namespace, accountId }) {
        if (!namespace) {
            return Promise.resolve([]);
        }
        return this.memoizedGetRequest('metrics', {
            region: this.templateSrv.replace(this.getActualRegion(region)),
            namespace: this.templateSrv.replace(namespace),
            accountId: this.templateSrv.replace(accountId),
        }).then((metrics) => metrics.map((m) => ({ label: m.value.name, value: m.value.name })));
    }
    getAllMetrics({ region, accountId }) {
        return this.memoizedGetRequest('metrics', {
            region: this.templateSrv.replace(this.getActualRegion(region)),
            accountId: this.templateSrv.replace(accountId),
        }).then((metrics) => metrics.map((m) => ({ metricName: m.value.name, namespace: m.value.namespace })));
    }
    getDimensionKeys({ region, namespace = '', dimensionFilters = {}, metricName = '', accountId, }) {
        return this.memoizedGetRequest('dimension-keys', {
            region: this.templateSrv.replace(this.getActualRegion(region)),
            namespace: this.templateSrv.replace(namespace),
            accountId: this.templateSrv.replace(accountId),
            metricName: this.templateSrv.replace(metricName),
            dimensionFilters: JSON.stringify(this.convertDimensionFormat(dimensionFilters, {})),
        }).then((r) => r.map((r) => ({ label: r.value, value: r.value })));
    }
    getDimensionValues({ dimensionKey, region, namespace, dimensionFilters = {}, metricName = '', accountId, }) {
        if (!namespace || !metricName) {
            return Promise.resolve([]);
        }
        return this.memoizedGetRequest('dimension-values', {
            region: this.templateSrv.replace(this.getActualRegion(region)),
            namespace: this.templateSrv.replace(namespace),
            metricName: this.templateSrv.replace(metricName.trim()),
            dimensionKey: this.templateSrv.replace(dimensionKey),
            dimensionFilters: JSON.stringify(this.convertDimensionFormat(dimensionFilters, {})),
            accountId: this.templateSrv.replace(accountId),
        }).then((r) => r.map((r) => ({ label: r.value, value: r.value })));
    }
    getEbsVolumeIds(region, instanceId) {
        return this.memoizedGetRequest('ebs-volume-ids', {
            region: this.templateSrv.replace(this.getActualRegion(region)),
            instanceId: this.templateSrv.replace(instanceId),
        });
    }
    getEc2InstanceAttribute(region, attributeName, filters) {
        return this.memoizedGetRequest('ec2-instance-attribute', {
            region: this.templateSrv.replace(this.getActualRegion(region)),
            attributeName: this.templateSrv.replace(attributeName),
            filters: JSON.stringify(this.convertMultiFilterFormat(filters, 'filter key')),
        });
    }
    getResourceARNs(region, resourceType, tags) {
        return this.memoizedGetRequest('resource-arns', {
            region: this.templateSrv.replace(this.getActualRegion(region)),
            resourceType: this.templateSrv.replace(resourceType),
            tags: JSON.stringify(this.convertMultiFilterFormat(tags, 'tag name')),
        });
    }
    legacyDescribeLogGroups(region, logGroupNamePrefix) {
        return this.memoizedGetRequest('legacy-log-groups', {
            region: this.templateSrv.replace(this.getActualRegion(region)),
            logGroupNamePrefix: logGroupNamePrefix || '',
        });
    }
}
//# sourceMappingURL=ResourcesAPI.js.map