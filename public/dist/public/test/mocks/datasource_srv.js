import { Observable } from 'rxjs';
import { DataSourceApi, getDataSourceUID, } from '@grafana/data';
export class DatasourceSrvMock {
    constructor(defaultDS, datasources) {
        this.defaultDS = defaultDS;
        this.datasources = datasources;
        //
    }
    get(ref) {
        var _a;
        if (!ref) {
            return Promise.resolve(this.defaultDS);
        }
        const uid = (_a = getDataSourceUID(ref)) !== null && _a !== void 0 ? _a : '';
        const ds = this.datasources[uid];
        if (ds) {
            return Promise.resolve(ds);
        }
        return Promise.reject(`Unknown Datasource: ${JSON.stringify(ref)}`);
    }
}
export class MockDataSourceApi extends DataSourceApi {
    constructor(name, result, meta, error = null) {
        super({ name: name ? name : 'MockDataSourceApi' });
        this.error = error;
        this.result = { data: [] };
        if (result) {
            this.result = result;
        }
        this.meta = meta || {};
    }
    query(request) {
        if (this.error) {
            return Promise.reject(this.error);
        }
        return new Promise((resolver) => {
            setTimeout(() => {
                resolver(this.result);
            });
        });
    }
    testDatasource() {
        return Promise.resolve({ message: '', status: '' });
    }
    setupMixed(value) {
        this.meta = this.meta || {};
        this.meta.mixed = value;
        return this;
    }
}
export class MockObservableDataSourceApi extends DataSourceApi {
    constructor(name, results, meta, error = null) {
        super({ name: name ? name : 'MockDataSourceApi' });
        this.error = error;
        this.results = [{ data: [] }];
        if (results) {
            this.results = results;
        }
        this.meta = meta || {};
    }
    query(request) {
        return new Observable((observer) => {
            if (this.error) {
                observer.error(this.error);
            }
            if (this.results) {
                this.results.forEach((response) => observer.next(response));
                observer.complete();
            }
        });
    }
    testDatasource() {
        return Promise.resolve({ message: '', status: '' });
    }
}
//# sourceMappingURL=datasource_srv.js.map