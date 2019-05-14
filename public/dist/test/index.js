// const context = require.context('./', true, /_specs\.ts/);
// context.keys().forEach(context);
// module.exports = context;
import * as tslib_1 from "tslib";
var e_1, _a;
import '@babel/polyfill';
import 'jquery';
import angular from 'angular';
import 'angular-mocks';
import 'app/app';
// configure enzyme
import Enzyme from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';
Enzyme.configure({ adapter: new Adapter() });
angular.module('grafana', ['ngRoute']);
angular.module('grafana.services', ['ngRoute', '$strap.directives']);
angular.module('grafana.panels', []);
angular.module('grafana.controllers', []);
angular.module('grafana.directives', []);
angular.module('grafana.filters', []);
angular.module('grafana.routes', ['ngRoute']);
var context = require.context('../', true, /specs\.(tsx?|js)/);
try {
    for (var _b = tslib_1.__values(context.keys()), _c = _b.next(); !_c.done; _c = _b.next()) {
        var key = _c.value;
        context(key);
    }
}
catch (e_1_1) { e_1 = { error: e_1_1 }; }
finally {
    try {
        if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
    }
    finally { if (e_1) throw e_1.error; }
}
//# sourceMappingURL=index.js.map