var _a;
import { __awaiter, __generator, __values } from "tslib";
var monacoPath = ((_a = window.__grafana_public_path__) !== null && _a !== void 0 ? _a : 'public/') + 'lib/monaco/min/vs';
var scripts = [
    [monacoPath + "/language/kusto/bridge.min.js"],
    [
        monacoPath + "/language/kusto/kusto.javascript.client.min.js",
        monacoPath + "/language/kusto/newtonsoft.json.min.js",
        monacoPath + "/language/kusto/Kusto.Language.Bridge.min.js",
    ],
];
function loadScript(script) {
    return new Promise(function (resolve, reject) {
        var scriptEl;
        if (typeof script === 'string') {
            scriptEl = document.createElement('script');
            scriptEl.src = script;
        }
        else {
            scriptEl = script;
        }
        scriptEl.onload = function () { return resolve(); };
        scriptEl.onerror = function (err) { return reject(err); };
        document.body.appendChild(scriptEl);
    });
}
var loadMonacoKusto = function () {
    return new Promise(function (resolve) {
        window.__monacoKustoResolvePromise = resolve;
        var script = document.createElement('script');
        script.innerHTML = "require(['vs/language/kusto/monaco.contribution'], function() {\n      window.__monacoKustoResolvePromise();\n    });";
        return document.body.appendChild(script);
    });
};
export default function loadKusto() {
    return __awaiter(this, void 0, void 0, function () {
        var promise, scripts_1, scripts_1_1, parallelScripts, allPromises, e_1_1;
        var e_1, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    promise = Promise.resolve();
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 7, 8, 9]);
                    scripts_1 = __values(scripts), scripts_1_1 = scripts_1.next();
                    _b.label = 2;
                case 2:
                    if (!!scripts_1_1.done) return [3 /*break*/, 6];
                    parallelScripts = scripts_1_1.value;
                    return [4 /*yield*/, promise];
                case 3:
                    _b.sent();
                    allPromises = parallelScripts
                        .filter(function (src) { return !document.querySelector("script[src=\"" + src + "\"]"); })
                        .map(function (src) { return loadScript(src); });
                    return [4 /*yield*/, Promise.all(allPromises)];
                case 4:
                    _b.sent();
                    _b.label = 5;
                case 5:
                    scripts_1_1 = scripts_1.next();
                    return [3 /*break*/, 2];
                case 6: return [3 /*break*/, 9];
                case 7:
                    e_1_1 = _b.sent();
                    e_1 = { error: e_1_1 };
                    return [3 /*break*/, 9];
                case 8:
                    try {
                        if (scripts_1_1 && !scripts_1_1.done && (_a = scripts_1.return)) _a.call(scripts_1);
                    }
                    finally { if (e_1) throw e_1.error; }
                    return [7 /*endfinally*/];
                case 9: return [4 /*yield*/, loadMonacoKusto()];
                case 10:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    });
}
//# sourceMappingURL=kusto.js.map