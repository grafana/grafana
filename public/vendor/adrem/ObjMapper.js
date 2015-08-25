/**
 * Created with JetBrains WebStorm.
 * User: tomasz.kunicki
 * Date: 8/23/13
 * Time: 12:08 AM
 * To change this template use File | Settings | File Templates.
 */
var adrem;
(function (adrem) {
    'use strict';
    var RemoteObjProxy = (function () {
        function RemoteObjProxy(params, Map, SrvIntface, callback) {
            this.Map = Map;
            var remoteObject, p = [Map.classId], method, self = this, defaultConverter;
            if (params !== undefined) {
                p.push(params);
            }
            remoteObject = new SrvIntface({ params: p, callback: callback });
            defaultConverter = {
                // Default parameter conversion based on comma delimited list of parameters
                getParams: function (params, info) {
                    var paramNames = (info.params === undefined) ? [] : info.params.split(","), result = [];
                    paramNames.forEach(function (p) {
                        result.push(params[p]);
                    });
                    return result;
                },
                getResult: function (res, info) {
                    var props, result = {};
                    if (typeof info.result == 'string') {
                        props = info.result.split(",");
                    }
                    if (info.result !== undefined) {
                        props = info.result.split(",");
                        if (res.Result != null) {
                            props.forEach(function (p, i) {
                                if (i < res.Result.length) {
                                    result[p] = res.Result[i];
                                }
                            });
                        }
                    }
                    else {
                        result = res.Result;
                    }
                    return result;
                }
            };
            for (method in Map.methods) {
                if (Map.methods.hasOwnProperty(method)) {
                    self[method] = (function (m) {
                        var def = Map.methods[method], convert = adrem.extend(def.convert, defaultConverter);
                        return function (params, callback) {
                            // no parameters just call back
                            if (typeof params === 'function') {
                                callback = params;
                                params = {};
                            }
                            // extend params with default
                            params = adrem.extend(params, def.default);
                            remoteObject.request(def.id, convert.getParams(params, def), function (res) {
                                if (callback !== undefined) {
                                    callback(convert.getResult(res, def));
                                }
                            });
                        };
                    })(method);
                }
            }
        }
        RemoteObjProxy.prototype.asStringListData = function (data, reversed, decodeValue) {
            var result = [];
            reversed = reversed || true;
            data.forEach(function (s) {
                var v = s.split("="), d = {}, name, val;
                name = reversed ? v[1] : v[0];
                val = reversed ? v[0] : v[1];
                if (typeof decodeValue == 'function') {
                    val = decodeValue(val);
                }
                d[name] = val;
                result.push(d);
            });
            return result;
        };
        RemoteObjProxy.prototype.asParamList = function (data) {
            return this.asStringListData(data, false);
        };
        return RemoteObjProxy;
    })();
    adrem.RemoteObjProxy = RemoteObjProxy;
})(adrem || (adrem = {}));
//# sourceMappingURL=ObjMapper.js.map