import { __extends } from "tslib";
import { DataSourceApi, getDataSourceUID, } from '@grafana/data';
import { Observable } from 'rxjs';
var DatasourceSrvMock = /** @class */ (function () {
    function DatasourceSrvMock(defaultDS, datasources) {
        this.defaultDS = defaultDS;
        this.datasources = datasources;
        //
    }
    DatasourceSrvMock.prototype.get = function (ref) {
        var _a;
        if (!ref) {
            return Promise.resolve(this.defaultDS);
        }
        var uid = (_a = getDataSourceUID(ref)) !== null && _a !== void 0 ? _a : '';
        var ds = this.datasources[uid];
        if (ds) {
            return Promise.resolve(ds);
        }
        return Promise.reject("Unknown Datasource: " + JSON.stringify(ref));
    };
    return DatasourceSrvMock;
}());
export { DatasourceSrvMock };
var MockDataSourceApi = /** @class */ (function (_super) {
    __extends(MockDataSourceApi, _super);
    function MockDataSourceApi(name, result, meta, error) {
        if (error === void 0) { error = null; }
        var _this = _super.call(this, { name: name ? name : 'MockDataSourceApi' }) || this;
        _this.error = error;
        _this.result = { data: [] };
        if (result) {
            _this.result = result;
        }
        _this.meta = meta || {};
        return _this;
    }
    MockDataSourceApi.prototype.query = function (request) {
        var _this = this;
        if (this.error) {
            return Promise.reject(this.error);
        }
        return new Promise(function (resolver) {
            setTimeout(function () {
                resolver(_this.result);
            });
        });
    };
    MockDataSourceApi.prototype.testDatasource = function () {
        return Promise.resolve();
    };
    return MockDataSourceApi;
}(DataSourceApi));
export { MockDataSourceApi };
var MockObservableDataSourceApi = /** @class */ (function (_super) {
    __extends(MockObservableDataSourceApi, _super);
    function MockObservableDataSourceApi(name, results, meta, error) {
        if (error === void 0) { error = null; }
        var _this = _super.call(this, { name: name ? name : 'MockDataSourceApi' }) || this;
        _this.error = error;
        _this.results = [{ data: [] }];
        if (results) {
            _this.results = results;
        }
        _this.meta = meta || {};
        return _this;
    }
    MockObservableDataSourceApi.prototype.query = function (request) {
        var _this = this;
        return new Observable(function (observer) {
            if (_this.error) {
                observer.error(_this.error);
            }
            if (_this.results) {
                _this.results.forEach(function (response) { return observer.next(response); });
                observer.complete();
            }
        });
    };
    MockObservableDataSourceApi.prototype.testDatasource = function () {
        return Promise.resolve();
    };
    return MockObservableDataSourceApi;
}(DataSourceApi));
export { MockObservableDataSourceApi };
//# sourceMappingURL=datasource_srv.js.map