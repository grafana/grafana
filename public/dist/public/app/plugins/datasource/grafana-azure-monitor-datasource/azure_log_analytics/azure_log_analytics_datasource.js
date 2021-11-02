import { __awaiter, __extends, __generator, __values } from "tslib";
import { map } from 'lodash';
import LogAnalyticsQuerystringBuilder from '../log_analytics/querystring_builder';
import ResponseParser, { transformMetadataToKustoSchema } from './response_parser';
import { AzureQueryType, } from '../types';
import { getTemplateSrv, DataSourceWithBackend } from '@grafana/runtime';
import { from } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { getAuthType, getAzureCloud, getAzurePortalUrl } from '../credentials';
import { isGUIDish } from '../components/ResourcePicker/utils';
import { interpolateVariable, routeNames } from '../utils/common';
var AzureLogAnalyticsDatasource = /** @class */ (function (_super) {
    __extends(AzureLogAnalyticsDatasource, _super);
    function AzureLogAnalyticsDatasource(instanceSettings) {
        var _this = _super.call(this, instanceSettings) || this;
        _this.instanceSettings = instanceSettings;
        _this.cache = new Map();
        _this.resourcePath = "" + routeNames.logAnalytics;
        _this.azureMonitorPath = routeNames.azureMonitor + "/subscriptions";
        var cloud = getAzureCloud(instanceSettings);
        _this.azurePortalUrl = getAzurePortalUrl(cloud);
        _this.defaultSubscriptionId = _this.instanceSettings.jsonData.subscriptionId || '';
        return _this;
    }
    AzureLogAnalyticsDatasource.prototype.isConfigured = function () {
        // If validation didn't return any error then the data source is properly configured
        return !this.validateDatasource();
    };
    AzureLogAnalyticsDatasource.prototype.filterQuery = function (item) {
        var _a;
        return item.hide !== true && !!((_a = item.azureLogAnalytics) === null || _a === void 0 ? void 0 : _a.query) && !!item.azureLogAnalytics.resource;
    };
    AzureLogAnalyticsDatasource.prototype.getSubscriptions = function () {
        return __awaiter(this, void 0, void 0, function () {
            var path;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.isConfigured()) {
                            return [2 /*return*/, []];
                        }
                        path = this.azureMonitorPath + "?api-version=2019-03-01";
                        return [4 /*yield*/, this.getResource(path).then(function (result) {
                                return ResponseParser.parseSubscriptions(result);
                            })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    AzureLogAnalyticsDatasource.prototype.getWorkspaces = function (subscription) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getWorkspaceList(subscription)];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, (map(response.value, function (val) {
                                return {
                                    text: val.name,
                                    value: val.id,
                                };
                            }) || [])];
                }
            });
        });
    };
    AzureLogAnalyticsDatasource.prototype.getWorkspaceList = function (subscription) {
        var subscriptionId = getTemplateSrv().replace(subscription || this.defaultSubscriptionId);
        var workspaceListUrl = this.azureMonitorPath +
            ("/" + subscriptionId + "/providers/Microsoft.OperationalInsights/workspaces?api-version=2017-04-26-preview");
        return this.getResource(workspaceListUrl);
    };
    AzureLogAnalyticsDatasource.prototype.getMetadata = function (resourceUri) {
        return __awaiter(this, void 0, void 0, function () {
            var path, resp;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        path = this.resourcePath + "/v1" + resourceUri + "/metadata";
                        return [4 /*yield*/, this.getResource(path)];
                    case 1:
                        resp = _a.sent();
                        return [2 /*return*/, resp];
                }
            });
        });
    };
    AzureLogAnalyticsDatasource.prototype.getKustoSchema = function (resourceUri) {
        return __awaiter(this, void 0, void 0, function () {
            var metadata;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getMetadata(resourceUri)];
                    case 1:
                        metadata = _a.sent();
                        return [2 /*return*/, transformMetadataToKustoSchema(metadata, resourceUri)];
                }
            });
        });
    };
    AzureLogAnalyticsDatasource.prototype.applyTemplateVariables = function (target, scopedVars) {
        var item = target.azureLogAnalytics;
        if (!item) {
            return target;
        }
        var templateSrv = getTemplateSrv();
        var resource = templateSrv.replace(item.resource, scopedVars);
        var workspace = templateSrv.replace(item.workspace, scopedVars);
        if (!workspace && !resource && this.firstWorkspace) {
            workspace = this.firstWorkspace;
        }
        var query = templateSrv.replace(item.query, scopedVars, interpolateVariable);
        return {
            refId: target.refId,
            queryType: AzureQueryType.LogAnalytics,
            azureLogAnalytics: {
                resultFormat: item.resultFormat,
                query: query,
                resource: resource,
                // Workspace was removed in Grafana 8, but remains for backwards compat
                workspace: workspace,
            },
        };
    };
    /**
     * Augment the results with links back to the azure console
     */
    AzureLogAnalyticsDatasource.prototype.query = function (request) {
        var _this = this;
        return _super.prototype.query.call(this, request).pipe(mergeMap(function (res) {
            return from(_this.processResponse(res));
        }));
    };
    AzureLogAnalyticsDatasource.prototype.processResponse = function (res) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function () {
            var _c, _d, df, encodedQuery, url, _e, _f, field, e_1_1;
            var e_1, _g, e_2, _h;
            return __generator(this, function (_j) {
                switch (_j.label) {
                    case 0:
                        if (!res.data) return [3 /*break*/, 8];
                        _j.label = 1;
                    case 1:
                        _j.trys.push([1, 6, 7, 8]);
                        _c = __values(res.data), _d = _c.next();
                        _j.label = 2;
                    case 2:
                        if (!!_d.done) return [3 /*break*/, 5];
                        df = _d.value;
                        encodedQuery = (_b = (_a = df.meta) === null || _a === void 0 ? void 0 : _a.custom) === null || _b === void 0 ? void 0 : _b.encodedQuery;
                        if (!(encodedQuery && encodedQuery.length > 0)) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.buildDeepLink(df.meta.custom)];
                    case 3:
                        url = _j.sent();
                        if (url === null || url === void 0 ? void 0 : url.length) {
                            try {
                                for (_e = (e_2 = void 0, __values(df.fields)), _f = _e.next(); !_f.done; _f = _e.next()) {
                                    field = _f.value;
                                    field.config.links = [
                                        {
                                            url: url,
                                            title: 'View in Azure Portal',
                                            targetBlank: true,
                                        },
                                    ];
                                }
                            }
                            catch (e_2_1) { e_2 = { error: e_2_1 }; }
                            finally {
                                try {
                                    if (_f && !_f.done && (_h = _e.return)) _h.call(_e);
                                }
                                finally { if (e_2) throw e_2.error; }
                            }
                        }
                        _j.label = 4;
                    case 4:
                        _d = _c.next();
                        return [3 /*break*/, 2];
                    case 5: return [3 /*break*/, 8];
                    case 6:
                        e_1_1 = _j.sent();
                        e_1 = { error: e_1_1 };
                        return [3 /*break*/, 8];
                    case 7:
                        try {
                            if (_d && !_d.done && (_g = _c.return)) _g.call(_c);
                        }
                        finally { if (e_1) throw e_1.error; }
                        return [7 /*endfinally*/];
                    case 8: return [2 /*return*/, res];
                }
            });
        });
    };
    AzureLogAnalyticsDatasource.prototype.buildDeepLink = function (customMeta) {
        return __awaiter(this, void 0, void 0, function () {
            var base64Enc, workspaceId, subscription, details, url;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        base64Enc = encodeURIComponent(customMeta.encodedQuery);
                        workspaceId = customMeta.workspace;
                        subscription = customMeta.subscription;
                        return [4 /*yield*/, this.getWorkspaceDetails(workspaceId)];
                    case 1:
                        details = _a.sent();
                        if (!details.workspace || !details.resourceGroup) {
                            return [2 /*return*/, ''];
                        }
                        url = this.azurePortalUrl + "/#blade/Microsoft_OperationsManagementSuite_Workspace/" +
                            "AnalyticsBlade/initiator/AnalyticsShareLinkToQuery/isQueryEditorVisible/true/scope/" +
                            ("%7B%22resources%22%3A%5B%7B%22resourceId%22%3A%22%2Fsubscriptions%2F" + subscription) +
                            ("%2Fresourcegroups%2F" + details.resourceGroup + "%2Fproviders%2Fmicrosoft.operationalinsights%2Fworkspaces%2F" + details.workspace) +
                            ("%22%7D%5D%7D/query/" + base64Enc + "/isQueryBase64Compressed/true/timespanInIsoFormat/P1D");
                        return [2 /*return*/, url];
                }
            });
        });
    };
    AzureLogAnalyticsDatasource.prototype.getWorkspaceDetails = function (workspaceId) {
        return __awaiter(this, void 0, void 0, function () {
            var response, details, regex, results;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.defaultSubscriptionId) {
                            return [2 /*return*/, {}];
                        }
                        return [4 /*yield*/, this.getWorkspaceList(this.defaultSubscriptionId)];
                    case 1:
                        response = _a.sent();
                        details = response.value.find(function (o) {
                            return o.properties.customerId === workspaceId;
                        });
                        if (!details) {
                            return [2 /*return*/, {}];
                        }
                        regex = /.*resourcegroups\/(.*)\/providers.*/;
                        results = regex.exec(details.id);
                        if (!results || results.length < 2) {
                            return [2 /*return*/, {}];
                        }
                        return [2 /*return*/, {
                                workspace: details.name,
                                resourceGroup: results[1],
                            }];
                }
            });
        });
    };
    /**
     * This is named differently than DataSourceApi.metricFindQuery
     * because it's not exposed to Grafana like the main AzureMonitorDataSource.
     * And some of the azure internal data sources return null in this function, which the
     * external interface does not support
     */
    AzureLogAnalyticsDatasource.prototype.metricFindQueryInternal = function (query, optionalOptions) {
        var _this = this;
        // workspaces() - Get workspaces in the default subscription
        var workspacesQuery = query.match(/^workspaces\(\)/i);
        if (workspacesQuery) {
            if (this.defaultSubscriptionId) {
                return this.getWorkspaces(this.defaultSubscriptionId);
            }
            else {
                throw new Error('No subscription ID. Specify a default subscription ID in the data source config to use workspaces() without a subscription ID');
            }
        }
        // workspaces("abc-def-etc") - Get workspaces a specified subscription
        var workspacesQueryWithSub = query.match(/^workspaces\(["']?([^\)]+?)["']?\)/i);
        if (workspacesQueryWithSub) {
            return this.getWorkspaces((workspacesQueryWithSub[1] || '').trim());
        }
        // Execute the query as KQL to the default or first workspace
        return this.getFirstWorkspace().then(function (resourceURI) {
            if (!resourceURI) {
                return [];
            }
            var queries = _this.buildQuery(query, optionalOptions, resourceURI);
            var promises = _this.doQueries(queries);
            return Promise.all(promises)
                .then(function (results) {
                return new ResponseParser(results).parseToVariables();
            })
                .catch(function (err) {
                if (err.error &&
                    err.error.data &&
                    err.error.data.error &&
                    err.error.data.error.innererror &&
                    err.error.data.error.innererror.innererror) {
                    throw { message: err.error.data.error.innererror.innererror.message };
                }
                else if (err.error && err.error.data && err.error.data.error) {
                    throw { message: err.error.data.error.message };
                }
                throw err;
            });
        });
    };
    AzureLogAnalyticsDatasource.prototype.buildQuery = function (query, options, workspace) {
        var querystringBuilder = new LogAnalyticsQuerystringBuilder(getTemplateSrv().replace(query, {}, interpolateVariable), options, 'TimeGenerated');
        var querystring = querystringBuilder.generate().uriString;
        var path = isGUIDish(workspace)
            ? this.resourcePath + "/v1/workspaces/" + workspace + "/query?" + querystring
            : this.resourcePath + "/v1" + workspace + "/query?" + querystring;
        var queries = [
            {
                datasourceId: this.id,
                path: path,
                resultFormat: 'table',
            },
        ];
        return queries;
    };
    AzureLogAnalyticsDatasource.prototype.getDefaultOrFirstSubscription = function () {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var subscriptions;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (this.defaultSubscriptionId) {
                            return [2 /*return*/, this.defaultSubscriptionId];
                        }
                        return [4 /*yield*/, this.getSubscriptions()];
                    case 1:
                        subscriptions = _b.sent();
                        return [2 /*return*/, (_a = subscriptions[0]) === null || _a === void 0 ? void 0 : _a.value];
                }
            });
        });
    };
    AzureLogAnalyticsDatasource.prototype.getFirstWorkspace = function () {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var subscriptionId, workspaces, workspace;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (this.firstWorkspace) {
                            return [2 /*return*/, this.firstWorkspace];
                        }
                        return [4 /*yield*/, this.getDefaultOrFirstSubscription()];
                    case 1:
                        subscriptionId = _b.sent();
                        if (!subscriptionId) {
                            return [2 /*return*/, undefined];
                        }
                        return [4 /*yield*/, this.getWorkspaces(subscriptionId)];
                    case 2:
                        workspaces = _b.sent();
                        workspace = (_a = workspaces[0]) === null || _a === void 0 ? void 0 : _a.value;
                        if (workspace) {
                            this.firstWorkspace = workspace;
                        }
                        return [2 /*return*/, workspace];
                }
            });
        });
    };
    AzureLogAnalyticsDatasource.prototype.annotationQuery = function (options) {
        if (!options.annotation.rawQuery) {
            return Promise.reject({
                message: 'Query missing in annotation definition',
            });
        }
        var queries = this.buildQuery(options.annotation.rawQuery, options, options.annotation.workspace);
        var promises = this.doQueries(queries);
        return Promise.all(promises).then(function (results) {
            var annotations = new ResponseParser(results).transformToAnnotations(options);
            return annotations;
        });
    };
    AzureLogAnalyticsDatasource.prototype.doQueries = function (queries) {
        var _this = this;
        return map(queries, function (query) {
            return _this.getResource(query.path)
                .then(function (result) {
                return {
                    result: result,
                    query: query,
                };
            })
                .catch(function (err) {
                throw {
                    error: err,
                    query: query,
                };
            });
        });
    };
    AzureLogAnalyticsDatasource.prototype.testDatasource = function () {
        return __awaiter(this, void 0, void 0, function () {
            var validationError, resourceOrWorkspace, result, e_3, message, path, e_4, message;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        validationError = this.validateDatasource();
                        if (validationError) {
                            return [2 /*return*/, validationError];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.getFirstWorkspace()];
                    case 2:
                        result = _a.sent();
                        if (!result) {
                            return [2 /*return*/, {
                                    status: 'error',
                                    message: 'Workspace not found.',
                                }];
                        }
                        resourceOrWorkspace = result;
                        return [3 /*break*/, 4];
                    case 3:
                        e_3 = _a.sent();
                        message = 'Azure Log Analytics requires access to Azure Monitor but had the following error: ';
                        return [2 /*return*/, {
                                status: 'error',
                                message: this.getErrorMessage(message, e_3),
                            }];
                    case 4:
                        _a.trys.push([4, 6, , 7]);
                        path = isGUIDish(resourceOrWorkspace)
                            ? this.resourcePath + "/v1/workspaces/" + resourceOrWorkspace + "/metadata"
                            : this.resourcePath + "/v1" + resourceOrWorkspace + "/metadata";
                        return [4 /*yield*/, this.getResource(path).then(function (response) {
                                return {
                                    status: 'success',
                                    message: 'Successfully queried the Azure Log Analytics service.',
                                    title: 'Success',
                                };
                            })];
                    case 5: return [2 /*return*/, _a.sent()];
                    case 6:
                        e_4 = _a.sent();
                        message = 'Azure Log Analytics: ';
                        return [2 /*return*/, {
                                status: 'error',
                                message: this.getErrorMessage(message, e_4),
                            }];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    AzureLogAnalyticsDatasource.prototype.getErrorMessage = function (message, error) {
        message += error.statusText ? error.statusText + ': ' : '';
        if (error.data && error.data.error && error.data.error.code) {
            message += error.data.error.code + '. ' + error.data.error.message;
        }
        else if (error.data && error.data.error) {
            message += error.data.error;
        }
        else if (error.data) {
            message += error.data;
        }
        else {
            message += 'Cannot connect to Azure Log Analytics REST API.';
        }
        return message;
    };
    AzureLogAnalyticsDatasource.prototype.validateDatasource = function () {
        var authType = getAuthType(this.instanceSettings);
        if (authType === 'clientsecret') {
            if (!this.isValidConfigField(this.instanceSettings.jsonData.tenantId)) {
                return {
                    status: 'error',
                    message: 'The Tenant Id field is required.',
                };
            }
            if (!this.isValidConfigField(this.instanceSettings.jsonData.clientId)) {
                return {
                    status: 'error',
                    message: 'The Client Id field is required.',
                };
            }
        }
        return undefined;
    };
    AzureLogAnalyticsDatasource.prototype.isValidConfigField = function (field) {
        return typeof field === 'string' && field.length > 0;
    };
    return AzureLogAnalyticsDatasource;
}(DataSourceWithBackend));
export default AzureLogAnalyticsDatasource;
//# sourceMappingURL=azure_log_analytics_datasource.js.map