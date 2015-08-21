define([
    'angular',
    'lodash'
  ],

function (angular, _) {

    'use strict';

    /* global adrem, angular, console */

    var module = angular.module('grafana.services'),
        C_PERSEC = '/sec',
        CNT_SEPARATOR = '|',
        CNT_SRC_SEPARATOR = '&',
        SIMPLE_CNT_SRC_ID = '',
        MIB_CNT_SRC_ID = 'MIB',
        XML_CNT_SRC_ID = 'XML',

        // Overall counter instances
        OVERALL_TOTAL   = '_Total',
        OVERALL_MAXIMUM = '_Maximum',
        OVERALL_MINIMUM = '_Minimum',
        OVERALL_AVERAGE = '_Average',
        OVERALL_COUNT   = '_Count',

        knownMSCounters = ['load time', 'check time', 'round trip time'];

    module
        .factory('netCrunchCounters', function ($q, netCrunchRemoteSession, netCrunchCounterConsts,
                                                netCrunchCounterTypes) {
            var snmpMibData = null,
                shortOidPathsCache = Object.create(null),
                fullOidPathsCache = Object.create(null),
                cn_SCT = 'Check Time',
                cn_RTT = 'Round Trip Time',
                client = netCrunchRemoteSession,
                counterTypes = netCrunchCounterTypes,
                counterConsts = netCrunchCounterConsts;

            function isOid (string) {
                if (string.indexOf(C_PERSEC) >= 0) {
                    string = string.replace(C_PERSEC, '');
                }
                return (string.match(/^((([0-9]+)\.)+[0-9]+)$/) != null);
            }

            function isMIBCnt (obj, cnt) {
                return (((isOid(obj) === true) && ((cnt === '') || (isOid(cnt) === true))) ||
                       ((obj === '') && (isOid(cnt) === true)));
            }

            function counterPathObject (counter, counterType) {
                if (counterType === counterConsts.CNT_TYPE.cstSimple) {
                    return counter;
                } else {
                    if (counterType === counterConsts.CNT_TYPE.cstXML) {
                        return XML_CNT_SRC_ID + CNT_SRC_SEPARATOR + counter;
                    }
                    if (counterType === counterConsts.CNT_TYPE.cstMIB) {
                        return MIB_CNT_SRC_ID + CNT_SRC_SEPARATOR + counter;
                    }
                }
            }

            function stringToCntType (type) {
                if (type === MIB_CNT_SRC_ID) {
                    return counterConsts.CNT_TYPE.cstMIB;
                } else {
                    return counterConsts.CNT_TYPE.cstXML;
                }
            }

            function getCounterPathType (counterPath) {
                var pathType;

                pathType = counterConsts.CNT_TYPE.cstSimple;

                if (counterPath.indexOf(CNT_SRC_SEPARATOR) > 0) {
                    pathType = stringToCntType(counterPath.split(CNT_SRC_SEPARATOR)[0]);
                }
                return pathType;
            }

            function removeCounterPathType (counterPath) {
                var resultPath = counterPath;

                if (counterPath.indexOf(CNT_SRC_SEPARATOR) > 0) {
                    resultPath = counterPath.split(CNT_SRC_SEPARATOR)[1];
                }

                return resultPath;
            }

            function removePerSecond (string) {
                return string.replace(C_PERSEC, '');
            }

            function parseSNMPPath (snmpPath) {
                var objectType,
                    objectValue,
                    snmpPathParts;

                if (snmpPath.indexOf(CNT_SRC_SEPARATOR) < 0) {
                    objectType = counterConsts.CNT_TYPE.cstXML;
                    objectValue = snmpPath;
                } else {
                    snmpPathParts = snmpPath.split(CNT_SRC_SEPARATOR);
                    objectType = stringToCntType(snmpPathParts[0]);
                    objectValue = snmpPathParts[1];
                }

                return {
                    type: objectType,
                    value: objectValue
                };
            }

            function displayStringToSnmpFunc (string) {
                var result = counterConsts.SNMP_FUNC.scfUnknown,
                    functionMap = {};

                functionMap[OVERALL_TOTAL] = counterConsts.SNMP_FUNC.scfSum;
                functionMap[OVERALL_AVERAGE] = counterConsts.SNMP_FUNC.scfAvg;
                functionMap[OVERALL_MAXIMUM] = counterConsts.SNMP_FUNC.scfMax;
                functionMap[OVERALL_MINIMUM] = counterConsts.SNMP_FUNC.scfMin;
                functionMap[OVERALL_COUNT] = counterConsts.SNMP_FUNC.scfCount;

                if (functionMap[string] != null) {
                    result = functionMap[string];
                }
                return result;
            }

            function parseShortPath (counterPath) {
                return decodePath(counterPath);
            }

            function parseOIDPath (oidPath) {
                var decodedPath = parseShortPath(oidPath),
                    instOID = decodedPath.obj,
                    objOID = decodedPath.cnt,
                    inst = decodedPath.inst,
                    instType,
                    isPerSec = (objOID.indexOf(C_PERSEC) >= 0),
                    decodedObjOID;

                if (isPerSec === true) {
                    objOID = objOID.replace(C_PERSEC, '');
                }

                if ((inst === '') || (inst === '-')) {
                    decodedObjOID = objOID.match(/(.*)\.([0-9]+)$/);
                    if (decodedObjOID.length > 1) {
                        objOID = decodedObjOID[1];
                        inst = decodedObjOID[2];
                    }

                    if (inst === '0') {
                        instType = counterConsts.SNMP_INSTANCE_TYPE.sitNone;
                    } else {
                        instType = counterConsts.SNMP_INSTANCE_TYPE.sitByIndex;
                    }
                } else {
                    if (inst.charAt(0) === '#') {
                        inst = inst.substr(1);
                        instType = counterConsts.SNMP_INSTANCE_TYPE.sitByIndex;
                    } else {
                        if ((inst.charAt(0) === '_') &&
                           (displayStringToSnmpFunc(inst) !== counterConsts.SNMP_FUNC.scfUnknown)) {
                            instType = counterConsts.SNMP_INSTANCE_TYPE.sitComputable;
                        } else {
                            instType = counterConsts.SNMP_INSTANCE_TYPE.sitByLookup;
                        }
                    }
                }

                return {
                    objOID: objOID,
                    instOID: instOID,
                    inst: inst,
                    type: instType,
                    isPerSec: isPerSec
                };
            }

            function parseXMLPath(xmlPath, hasInstance) {
                var decodedPath = parseShortPath(xmlPath),
                    inst = decodedPath.inst,
                    instType;

                if (hasInstance === true) {
                    instType = counterConsts.SNMP_INSTANCE_TYPE.sitByLookup;

                    if (inst !== '') {
                        if (inst.charAt(0) === '#') {
                            inst = inst.substr(1);
                            instType = counterConsts.SNMP_INSTANCE_TYPE.sitByIndex;
                        } else {
                            if (inst.charAt(0) === '_') {
                                instType = counterConsts.SNMP_INSTANCE_TYPE.sitComputable;
                            }
                        }
                    } else {
                        if ((inst === '') || (inst === '-')) {
                            instType = counterConsts.SNMP_INSTANCE_TYPE.sitNone;

                        } else {
                            instType = counterConsts.SNMP_INSTANCE_TYPE.sitByLookup;
                        }
                    }

                    decodedPath.inst = inst;
                    decodedPath.type = instType;
                }

                return decodedPath;
            }

            function parseCounterPath (counterPath) {
                var parsedCounterPath,
                    counterPathType = getCounterPathType(counterPath);

                if (counterPathType === counterConsts.CNT_TYPE.cstXML) {
                    parsedCounterPath = parseXMLPath(counterPath, true);
                } else {
                    if (counterPathType === counterConsts.CNT_TYPE.cstMIB) {
                        parsedCounterPath = parseOIDPath(removeCounterPathType(counterPath));
                        parsedCounterPath.obj = parsedCounterPath.objOID;
                        parsedCounterPath.cnt = '';
                        if (parsedCounterPath.inst === '') {
                            parsedCounterPath.inst = parsedCounterPath.instOID;
                        }
                    } else {
                        if (counterPathType === counterConsts.CNT_TYPE.cstSimple) {
                            parsedCounterPath = parseShortPath(counterPath);
                        }
                    }
                }

                return parsedCounterPath;
            }

            function getOidPath (oid, oidCache, getOidFunc) {
                var updateOidPath = false,
                    deferred = $q.defer();

                if (oidCache[oid] == null) {
                    oidCache[oid] = oid;
                    updateOidPath = true;
                } else {
                    if (oidCache[oid] === oid) {
                        updateOidPath = true;
                    }
                }

                if (updateOidPath === true) {
                    getOidFunc({oid: oid}, function (oidPath) {
                        oidCache[oid] = oidPath;
                        deferred.resolve(oidPath);
                    });
                } else {
                    deferred.resolve(oidCache[oid]);
                }

                return deferred.promise;
            }

            function initSnmpMibData () {
                if (snmpMibData == null) {
                    snmpMibData = new adrem.SnmpMibData('ncSrv');
                }
            }

            function getShortOidPath (oid) {
                initSnmpMibData();
                return getOidPath(oid, shortOidPathsCache, snmpMibData.getShortOidPath);
            }

            function getFullOidPath (oid) {
                initSnmpMibData();
                return getOidPath(oid, fullOidPathsCache, snmpMibData.getFullOidPath);
            }

            function decodePath(path) {
                var
                    parts = path.split(CNT_SEPARATOR), result = {};

                result.obj = parts[0];
                result.cnt = parts.length > 1 ? parts[1] : "";
                if (parts.length === 3) {
                    result.inst = parts[2];
                } else if (parts.length > 3) {
                    result.inst = parts.slice(2).join(CNT_SEPARATOR);
                } else {
                    result.inst = "";
                }
                return result;
            }

            function encodePath(parts) {
                var p = [parts.obj, parts.cnt];
                if (parts.inst !== '') {
                    p.push(parts.inst);
                }
                return p.join(CNT_SEPARATOR);
            }

            function decodeDisplayPath(displayPath) {
                var result = {obj: '', cnt: '', inst: ''}, objParts, ix, perSec;

                ix = displayPath.indexOf(C_PERSEC);
                perSec = (ix >= 0);
                if (perSec) {
                    displayPath = displayPath.substr(0, ix);
                }

                if (![
                        {fmt: new RegExp("(.+)\\((.+)\\)\\\\(.+)"), parts: ["obj", "inst", "cnt"]},// obj(inst)\cnt
                        {fmt: new RegExp("(.+)\\((.+)\\)"), parts: ["obj", "inst"]}, // obj(inst)
                        {fmt: new RegExp("(.+)\\\\(.+)"), parts: ["obj", "cnt"]} // obj\cnt
                    ].some(function (s) {
                            var parts = displayPath.match(s.fmt);
                            if (parts != null) {
                                s.parts.forEach(function (p, i) {
                                    result[p] = parts[i + 1];
                                });
                                return true;
                            } else {
                                return false;
                            }
                        })) {
                    // formats do not match
                    result.obj = displayPath;
                }
                // Fix SNMP column path
                if (result.cnt === '' && result.obj !== '') {
                    if (result.obj.match("^[0-9\\.]+(\\.[0-9]+)$")) {
                        result.cnt = '';
                        if (result.inst !== '') {
                            result.obj = result.obj + '.' + result.inst;
                            result.inst = '';
                        }
                    } else if (result.obj.indexOf('.') >= 0) {
                        objParts = result.obj.split('.');
                        result.cnt = objParts[1];
                        result.obj = objParts[0];
                    } else {
                        result.cnt = result.obj;
                        result.obj = '';
                    }
                }
                result.perSec = perSec;
                if (perSec) {
                    result.cnt = result.cnt + C_PERSEC;
                }
                return result;
            }

            function removePerSec(displayName) {
                var ix = displayName.indexOf(C_PERSEC);
                //todo: check if ix == displayName.length - C_PERSEC.length
                return displayName.substr(0, ix);
            }

            function encodeDisplayPath(parts, withPerSec) {
                var result = parts.obj, ix;
                withPerSec = (withPerSec == null) ? true : withPerSec;

                if (parts.inst !== '' && parts.inst != null) {
                    result = parts.obj + '(' + parts.inst + ')';
                }

                if (parts.cnt !== '' && parts.cnt != null) {
                    if (!withPerSec && parts.perSec) { // remove /sec from counter name
                        ix = parts.cnt.indexOf(C_PERSEC);
                        result = result + '\\' + parts.cnt.substr(0, ix);
                    } else {
                        result = result + '\\' + parts.cnt;
                    }
                }
                return result;
            }

            function counterToString (counterPath) {
                var decodedCounter;

                decodedCounter = decodePath(counterPath);
                return encodeDisplayPath(decodedCounter, true);
            }

            function makeShortPath (object, counter, instance){
                if (instance === '') {
                    return object + CNT_SEPARATOR + counter;
                } else {
                    return object + CNT_SEPARATOR + counter + CNT_SEPARATOR + instance;
                }
            }

            function getSNMPDisplayPath (counterPath, shortPath, showPerSecondValue) {
                var snmpPath,
                    oidPath,
                    displayPath = $q.when(null);

                snmpPath = parseSNMPPath(counterPath);
                if (snmpPath.type === counterConsts.CNT_TYPE.cstXML) {
                    displayPath = $q.when(counterToString(snmpPath.value));
                } else {
                    if (snmpPath.type === counterConsts.CNT_TYPE.cstMIB) {
                        oidPath = parseOIDPath(counterPath);
                        if (shortPath === true) {
                            displayPath = getShortOidPath(oidPath.objOID);
                        } else {
                            displayPath = getFullOidPath(oidPath.objOID);
                        }

                        return displayPath.then(function(resolvedPath){
                            if ((resolvedPath == null) || (resolvedPath === '')){
                                resolvedPath = oidPath.objOID;
                            }
                            if (oidPath.inst === '0') {
                                oidPath.inst = '';
                            }

                            resolvedPath = counterToString(makeShortPath(resolvedPath, '', oidPath.inst));

                            if ((showPerSecondValue === true) && (oidPath.isPerSec === true)) {
                                resolvedPath = resolvedPath + C_PERSEC;
                            }
                            return resolvedPath;
                        });
                    }
                }

                return displayPath;
            }

            function counterPathToDisplayStr (counterPath, shortPath, showPerSecValue) {
                var pathType = getCounterPathType(counterPath);

                if ((pathType === counterConsts.CNT_TYPE.cstXML) || (pathType === counterConsts.CNT_TYPE.cstMIB)) {
                    return getSNMPDisplayPath(counterPath, shortPath, showPerSecValue);
                } else {
                    return $q.when(counterToString(counterPath));
                }
            }

            function isKnownMillisecondCounter(cnt) {
                return knownMSCounters.indexOf(cnt.toLowerCase()) >= 0;
            }

            /**
             * isMillisecondsCounter(
             * @param counter
             * @returns {boolean}
             */
            function isMillisecondsCounter(counter) {
                var c = decodePath(counter);
                return (c.cnt === cn_RTT) || (c.cnt === cn_SCT) || (c.cnt.toUpperCase().indexOf('MILLISECOND') >= 0) || isKnownMillisecondCounter(c.cnt);
            }

            function contains(cnt, substr) {
                return cnt.indexOf(substr) >= 0;
            }

            /**
             * isBytesCounter
             * @param displayName
             * @returns {null|''|'M'|'K'}
             */
            function isBytesCounter(displayName) {
                var result = '', cnt = displayName.toLowerCase();

                if (contains(cnt, client.res.metrics.bytes) || contains(cnt, client.res.metrics.memory) || contains(cnt, "octet")) {
                    if (contains(cnt, client.res.metrics.mbytes) || contains(cnt, 'mega')) {
                        result = 'M';
                    } else if (contains(cnt, client.res.metrics.kbytes) || contains(cnt, 'kilo')) {
                        result = 'K';
                    }
                    return result;
                } else {
                    return null;
                }
            }

            function getValueFormatting(value, base1, base, units) {
                units = units || ['K', 'M', 'G'];
                var range = '';
                if (value >= 1 * base1 && value < base1 * base) {
                    value = value / base1;
                    range = units[0];
                } else if (value >= base1 * base && value < base1 * base * base) {
                    value = value / base1 / base;
                    range = units[1];
                } else if (value >= base1 * base * base) {
                    value = value / base1 / base / base;
                    range = units[2];
                }
                return {
                    value: value,
                    units: range
                };
            }

            function getValueRange(value, kilo) {
                return getValueFormatting(value, kilo, kilo);
            }

            function getTimeRange(value) {
                return getValueFormatting(value, 1000, 60, ['sec', 'min', 'hrs']);
            }

            return {
                unitsToMetric : function (units, counterName, counterDisplayName) {
                    if (units === 'bytestobps') {
                        return 'bps';
                    } else if (units === 'percentage') {
                        return '%';
                    } else if (units === 'bytesps') {
                        return 'Bps';
                    } else if (units === 'bytes') {
                        return 'bytes';
                    } else {
                        return this.getMetric(counterName, counterDisplayName);
                    }
                },

                /**
                 * Get Metric for Counter
                 * @param counterPath
                 * @param displayName
                 * @returns {*}
                 */
                getMetric: function (counterPath, displayName) {
                    var multiplier;
                    if (contains(displayName, '%')) {
                        return counterTypes.percentage;
                    } else {
                        if (isMillisecondsCounter(counterPath)) {
                            return counterTypes.milliseconds;
                        } else {
                            multiplier = isBytesCounter(displayName);
                            if (multiplier !== null) {
                                if (multiplier !== '') {
                                    multiplier = '#' + multiplier;
                                }
                                if (contains(displayName, C_PERSEC) || contains(displayName, 'per sec.')) { //ESX counters are "per sec."
                                    return counterTypes.bytesBitsPS + multiplier;
                                } else {
                                    return counterTypes.bytes + multiplier;
                                }
                            } else {
                                return '';
                            }
                        }
                    }
                },

                getDisplayValue: function (value, metric) {
                    var ranges = '', mparts = metric.split('#'), m = mparts[0],
                        multiplier = mparts.length > 1 ? mparts[1] : "",
                        v, isBPS = (m === counterTypes.bytesBitsPS), isBytes = (m === counterTypes.bytes) || isBPS || (m === counterTypes.bytesBps),
                        isMS = (m === counterTypes.milliseconds),
                        isNoUnits = (m === '');

                    if (value == null || isNaN(value)) {
                        return {value: value, units: ''};
                    } else {
                        if (isBPS) {
                            value = value * 8;
                        }
                        if (multiplier !== '') {
                            return {
                                value: Math.round(value * 100) / 100,
                                units: multiplier + (isBytes ? 'B' : '')
                            };
                        }
                        if (isBytes) {
                            v = getValueRange(value, 1024);
                            if (m === counterTypes.bytes) {
                                v.units = v.units + 'B';
                            } else {
                                v.units = v.units + m;
                            }

                        } else if (isNoUnits) {
                            v = getValueRange(value, 1000);
                        } else {
                            if (isMS) {
                                v = getTimeRange(value);
                                if (v.units === '') {
                                    v.units = counterTypes.milliseconds;
                                }
                            } else {
                                v = {
                                    value: value,
                                    units: m
                                };
                            }
                        }
                        return {
                            value: v.value,
                            units: v.units
                        };
                    }
                },

                isOid: isOid,
                isMIBCnt: isMIBCnt,
                counterPathObject: counterPathObject,
                stringToCntType: stringToCntType,
                getCounterPathType: getCounterPathType,
                removeCounterPathType: removeCounterPathType,
                removePerSecond: removePerSecond,
                parseSNMPPath: parseSNMPPath,
                parseOIDPath: parseOIDPath,
                parseXMLPath: parseXMLPath,
                parseCounterPath: parseCounterPath,
                getShortOidPath: getShortOidPath,
                getFullOidPath: getFullOidPath,
                decodePath: decodePath,
                encodePath: encodePath,
                addInstance: function (path, inst) {
                    if (inst !== '') {
                        return path + CNT_SEPARATOR + inst;
                    } else {
                        return path;
                    }
                },
                decodeDisplayPath: decodeDisplayPath,
                encodeDisplayPath: encodeDisplayPath,
                removePerSec: removePerSec,
                getSNMPDisplayPath: getSNMPDisplayPath,
                counterPathToDisplayStr: counterPathToDisplayStr
            };
        });
});
