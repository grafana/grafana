"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDetectorWorker = initDetectorWorker;
exports.initClientWorker = initClientWorker;
function initDetectorWorker(options) {
    var db;
    var started = false;
    var clients = [];
    function crashReported(event) {
        if (event.data.event === 'crash-reported' && event.data.id) {
            var transaction = db.transaction(['tabs'], 'readwrite');
            var store = transaction.objectStore('tabs');
            store.delete(event.data.id);
        }
    }
    var INACTIVITY_THRESHOLD = options.inactivityThreshold;
    /**
     * Check which tabs have stopped sending updates but did not clear themselves properly
     */
    function checkStaleTabs() {
        var transaction = db.transaction(['tabs'], 'readwrite');
        var store = transaction.objectStore('tabs');
        var request = store.getAll();
        request.onsuccess = function () {
            var tabs = request.result;
            var activeTabs = [];
            var inactiveTabs = [];
            tabs.forEach(function (tab) {
                var workerInactivity = Date.now() - tab.workerLastActive;
                if (workerInactivity > INACTIVITY_THRESHOLD) {
                    inactiveTabs.push(tab);
                }
                else {
                    activeTabs.push(tab);
                }
            });
            if (activeTabs.length === 0) {
                // no active tabs, skip until a tab gets active
                return;
            }
            var candidate = activeTabs.pop();
            tabs.forEach(function (tab) {
                var workerInactivity = Date.now() - tab.workerLastActive;
                if (workerInactivity > INACTIVITY_THRESHOLD) {
                    reportCrash(tab, candidate);
                }
            });
        };
    }
    function reportCrash(tab, reporter) {
        clients.forEach(function (port) {
            port.postMessage({ event: 'crash-detected', tab: tab, reporter: reporter });
        });
    }
    self.onconnect = function (event) {
        return __awaiter(this, void 0, void 0, function () {
            var port_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!!started) return [3 /*break*/, 2];
                        return [4 /*yield*/, getDb()];
                    case 1:
                        db = _a.sent();
                        port_1 = event.ports[0];
                        clients.push(port_1);
                        port_1.start();
                        port_1.onmessage = crashReported;
                        port_1.onclose = function () {
                            clients = clients.filter(function (p) { return p !== port_1; });
                        };
                        setInterval(checkStaleTabs, INACTIVITY_THRESHOLD);
                        started = true;
                        _a.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    };
    function getDb() {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        var request = indexedDB.open(options.dbName);
                        request.onerror = function (event) {
                            reject(event.target.error);
                        };
                        request.onsuccess = function (event) {
                            resolve(event.target.result);
                        };
                        request.onupgradeneeded = function (event) {
                            var db = event.target.result;
                            if (!db.objectStoreNames.contains('tabs')) {
                                db.createObjectStore('tabs', { keyPath: 'id' });
                            }
                        };
                    })];
            });
        });
    }
}
function initClientWorker(options) {
    var _this = this;
    var lastInfo;
    var tabLastActive = Date.now();
    var db;
    setInterval(function () {
        // ping to tab so it can send latest values
        postMessage({ event: 'ping' });
        if (!(lastInfo === null || lastInfo === void 0 ? void 0 : lastInfo.id)) {
            return;
        }
        var transaction = db.transaction(['tabs'], 'readwrite');
        var store = transaction.objectStore('tabs');
        var workerLastActive = Date.now();
        // save latest received info here - the tab may be paused because of debugging but we need to mark the tab as alive anyway because the worker is still alive
        lastInfo = __assign(__assign({}, lastInfo), { tabLastActive: tabLastActive, workerLastActive: workerLastActive });
        store.put(lastInfo);
    }, options.pingInterval);
    addEventListener('message', function (event) { return __awaiter(_this, void 0, void 0, function () {
        var transaction, store;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (event.data.event === 'update') {
                        tabLastActive = Date.now();
                        lastInfo = __assign({}, event.data.info);
                    }
                    if (!(event.data.event === 'start')) return [3 /*break*/, 2];
                    return [4 /*yield*/, getDb()];
                case 1:
                    db = _a.sent();
                    _a.label = 2;
                case 2:
                    if (event.data.event === 'close') {
                        transaction = db.transaction(['tabs'], 'readwrite');
                        store = transaction.objectStore('tabs');
                        store.delete(event.data.info.id);
                    }
                    return [2 /*return*/];
            }
        });
    }); });
    function getDb() {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        var request = indexedDB.open(options.dbName);
                        request.onerror = function (event) {
                            reject(event.target.error);
                        };
                        request.onsuccess = function (event) {
                            resolve(event.target.result);
                        };
                        request.onupgradeneeded = function (event) {
                            var db = event.target.result;
                            if (!db.objectStoreNames.contains('tabs')) {
                                db.createObjectStore('tabs', { keyPath: 'id' });
                            }
                        };
                    })];
            });
        });
    }
}
