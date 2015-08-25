/**
 * User: tomasz.kunicki
 * Date: 8/24/13
 * Time: 1:37 AM
 * To change this template use File | Settings | File Templates.
 */
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
/// <reference path="ObjMapper.ts" />
var adrem;
(function (adrem) {
    'use strict';
    var ConvertedData = (function () {
        function ConvertedData() {
        }
        ConvertedData.fieldOrder = [];
        return ConvertedData;
    })();
    // Example - PassDB interface
    var PassDB = (function (_super) {
        __extends(PassDB, _super);
        function PassDB(apiName, callback) {
            var Map = {
                classId: 0x0000400A,
                methods: {
                    getNetwarePass: { id: 1, params: "Tree", result: "user, password" },
                    getWindowsPass: {
                        id: 2,
                        params: "nodeId, domain, useDefault",
                        result: "user, password",
                        default: { useDefault: true }
                    },
                    getLinuxPass: {
                        id: 3,
                        params: "nodeId, useDefault",
                        result: "user, password, rootPassword",
                        default: { useDefault: true }
                    },
                    geMacOSPass: {
                        id: 4,
                        params: "nodeId, useDefault",
                        result: "user, password",
                        default: { useDefault: true }
                    },
                    getBSDPass: {
                        id: 5,
                        params: "nodeId, useDefault",
                        result: "user, password, rootPassword",
                        default: { useDefault: true }
                    },
                    getESXPass: {
                        id: 21,
                        params: "nodeId, useDefault",
                        result: "user, password",
                        default: { useDefault: true }
                    },
                    getNodeSNMPProfile: { id: 6, params: "nodeId", result: "profileId" },
                    getSNMPProfile: { id: 7, params: "profileId" },
                    deleteNetwarePass: { id: 8, params: "tree" },
                    deleteNodePass: { id: 9, params: "nodeId" },
                    deleteSNMPProfile: { id: 10, params: "profileId, checkNodeAssignments" },
                    deleteNodeSNMPProfile: { id: 11, params: "nodeId" },
                    setNetWarePass: { id: 12, params: "tree, user, password" },
                    setWindowsPass: { id: 13, params: "nodeId, domain, user, password, options" },
                    setLinuxPass: { id: 14, params: "nodeId, user, password, rootPassword, options" },
                    setMacOSPass: { id: 15, params: "nodeId, user, password, options" },
                    setBSDPass: { id: 16, params: "nodeId, user, password, rootPassword, options" },
                    setESXPass: { id: 22, params: "nodeId, user, password" },
                    getSNMPProfileList: { id: 17 },
                    getNetwareTreeList: { id: 18 }
                }
            };
            _super.call(this, undefined, Map, adrem[apiName].AppServerObject, callback);
        }
        return PassDB;
    })(adrem.RemoteObjProxy);
    adrem.PassDB = PassDB;
    var TrendDB = (function (_super) {
        __extends(TrendDB, _super);
        function TrendDB(apiName, dataPath, callback) {
            var Map = {
                classId: 0x00000400,
                methods: {
                    getAvailableCounters: { id: 6 },
                    getCounterInstances: { id: 4, params: "machineId, cntPath" },
                    getCounters: { id: 3, params: "machineId" },
                    updateAll: { id: 5, params: "removeOlderThan" },
                    updateArchive: { id: 2, params: "machineId, removeOlderThan" }
                }
            };
            _super.call(this, [dataPath], Map, adrem[apiName].AppServerObject, callback);
            this.path = dataPath;
        }
        return TrendDB;
    })(adrem.RemoteObjProxy);
    adrem.TrendDB = TrendDB;
    var SimpleNCMonitorClient = (function (_super) {
        __extends(SimpleNCMonitorClient, _super);
        function SimpleNCMonitorClient(apiName, callback) {
            var Map = {
                classId: 0x00000420,
                methods: {
                    getActiveMonitorList: { id: 3 },
                    getCurrentAtlasId: { id: 1 },
                    getCurrentAtlasName: { id: 7 },
                    getCurrentAtlasDataPath: { id: 2 },
                    getNetCrunchDataPath: { id: 4, params: "folderName" },
                    getNetCrunchInstallPath: { id: 84 },
                    getCurrentAtlasDateCreated: { id: 5 },
                    getCurrentAtlasInfo: {
                        id: 6,
                        result: "id,name,dataPath,dateCreated,enabled,disabledFrom,disabledUntil,simulated"
                    },
                    igsNetworkSimulationMode: { id: 78 },
                    getWindowsForWorkgroupsMode: { id: 89 }
                }
            };
            _super.call(this, undefined, Map, adrem[apiName].AppServerObject, callback);
            return this;
        }
        return SimpleNCMonitorClient;
    })(adrem.RemoteObjProxy);
    adrem.SimpleNCMonitorClient = SimpleNCMonitorClient;
    var LicenseManager = (function (_super) {
        __extends(LicenseManager, _super);
        function LicenseManager(apiName, callback) {
            var Map = {
                classId: 0x0000409A,
                methods: {
                    installNcLicense: { id: 1, params: "fileName" },
                    installNcProductLicense: { id: 2, params: "fileName" },
                    getLicenseList: { id: 3 },
                    getLicenseInfo: {
                        id: 4,
                        result: "productVersion,educationalVersion,saExpirationDate,inventoryLicenseUnitCount,remoteAccessLicenseCount,nodeCountLimit,serialNumber,isDemoVersion"
                    },
                    getAtlasExpired: { id: 5, params: "id" }
                }
            };
            _super.call(this, undefined, Map, adrem[apiName].AppServerObject, callback);
        }
        return LicenseManager;
    })(adrem.RemoteObjProxy);
    adrem.LicenseManager = LicenseManager;
    var NcAdHelper = (function (_super) {
        __extends(NcAdHelper, _super);
        function NcAdHelper(apiName, callback) {
            var Map = {
                classId: 0x77731200,
                methods: {
                    getUserInfo: { id: 1, params: "userName,attributes", result: "success,errorMessage" }
                }
            };
            _super.call(this, undefined, Map, adrem[apiName].AppServerObject, callback);
        }
        return NcAdHelper;
    })(adrem.RemoteObjProxy);
    adrem.NcAdHelper = NcAdHelper;
    var MapBrowse = (function (_super) {
        __extends(MapBrowse, _super);
        function MapBrowse(apiName, callback) {
            var Map = {
                classId: 0x65433600,
                methods: {
                    getSystemMap: {
                        id: 3,
                        params: "type",
                        result: "success,displayName,id,parentId,imageIndex,nodeIds,childIds"
                    },
                    findMapById: {
                        id: 6,
                        params: "mapId",
                        result: "success,displayName,id,parentId,imageIndex,nodeIds,childIds"
                    },
                    getMapName: { id: 7, params: "mapId", result: "mapName,fullMapPath" }
                }
            };
            _super.call(this, undefined, Map, adrem[apiName].AppServerObject, callback);
        }
        return MapBrowse;
    })(adrem.RemoteObjProxy);
    adrem.MapBrowse = MapBrowse;
    var SnmpMibData = (function (_super) {
        __extends(SnmpMibData, _super);
        function SnmpMibData(apiName, callback) {
            var Map = {
                classId: 0x77740802,
                methods: {
                    getObjectInfo: {
                        id: 1,
                        params: "oid",
                        result: "success,nodeType,name,moduleName,enterprise,specificType,access,status,dataType,syntax,description"
                    },
                    getTrapVariables: { id: 2, params: "oid", result: "success,list" },
                    getFullOidPath: { id: 3, params: "oid" },
                    getShortOidPath: { id: 4, params: "oid" }
                }
            };
            _super.call(this, undefined, Map, adrem[apiName].AppServerObject, callback);
        }
        return SnmpMibData;
    })(adrem.RemoteObjProxy);
    adrem.SnmpMibData = SnmpMibData;
    var RemoteUserProfilesManager = (function (_super) {
        __extends(RemoteUserProfilesManager, _super);
        function RemoteUserProfilesManager(apiName, callback) {
            var Map = {
                classId: 0x00004012,
                methods: {
                    getGroupUserList: { id: 1, params: "groupId" },
                    getUserNameById: { id: 2, params: "userId" },
                    getGroupNameById: { id: 3, params: "groupId" },
                    getUserNotifications: { id: 4, params: "userId,currentTime" },
                    getUserMailNotifications: { id: 5, params: "userId,currentTime" },
                    getUsersWithRemoteAccessRights: { id: 6 },
                    getUserSessions: { id: 7, params: "allUsers,userId" },
                    disconnectAllUserSessions: { id: 8, params: "userId,disconnectMsg" },
                    disconnectSession: { id: 9, params: "byToken,sessionId,disconnectMsg" },
                    connectedUserCount: { id: 10 },
                    getUserCount: { id: 11 },
                    authenticateUser: {
                        id: 12,
                        params: "login,password,remoteIp",
                        result: "userProfileId,authToken,result"
                    },
                    changeUserPassword: {
                        id: 13,
                        params: "login,connectionToken,oldPassword,newPassword",
                        result: "changingAllowed,result"
                    },
                    authenticateSession: { id: 14, params: "remoteIp,authToken", result: "userProfileId,userName,result" }
                }
            };
            _super.call(this, undefined, Map, adrem[apiName].AppServerObject, callback);
        }
        return RemoteUserProfilesManager;
    })(adrem.RemoteObjProxy);
    adrem.RemoteUserProfilesManager = RemoteUserProfilesManager;
    var TaskSchedulerManager = (function (_super) {
        __extends(TaskSchedulerManager, _super);
        function TaskSchedulerManager(apiName, callback) {
            var Map = {
                classId: 0x00000431,
                methods: {
                    addNetToScan: {
                        id: 0,
                        params: "netId,atlasId,period,interval,scanTime,scanDay,lastScanDate,newTask"
                    },
                    removeNetFromScan: { id: 1, params: "netId,atlasId" },
                    addBackupTask: { id: 2, params: "atlasId,backupOpt,keepOld,period,interval,runTime,runDay,newTask" },
                    removeBackupTask: { id: 3, params: "atlasId" },
                    addTrendExportTask: { id: 4, params: "isNewTask" },
                    removeTrendExportTask: { id: 5 }
                }
            };
            _super.call(this, undefined, Map, adrem[apiName].AppServerObject, callback);
        }
        return TaskSchedulerManager;
    })(adrem.RemoteObjProxy);
    adrem.TaskSchedulerManager = TaskSchedulerManager;
    var NetCrunchGuard = (function (_super) {
        __extends(NetCrunchGuard, _super);
        function NetCrunchGuard(apiName, callback) {
            var Map = {
                classId: 0x0000400A,
                methods: {
                    programStarting: { id: 1, params: "processId", result: "result,oldProcessId" },
                    programClosing: { id: 2 },
                    restartService: { id: 3, params: "serviceName,delay" }
                }
            };
            _super.call(this, undefined, Map, adrem[apiName].AppServerObject, callback);
        }
        return NetCrunchGuard;
    })(adrem.RemoteObjProxy);
    adrem.NetCrunchGuard = NetCrunchGuard;
    var TrendCompressor = (function (_super) {
        __extends(TrendCompressor, _super);
        function TrendCompressor(apiName, callback) {
            var Map = {
                classId: 0x77730900,
                methods: {
                    getAtlasList: { id: 1 },
                    compressTrends: { id: 2, params: "atlasId", result: "errorMessage" }
                }
            };
            _super.call(this, undefined, Map, adrem[apiName].AppServerObject, callback);
        }
        return TrendCompressor;
    })(adrem.RemoteObjProxy);
    adrem.TrendCompressor = TrendCompressor;
    var StartupScript = (function (_super) {
        __extends(StartupScript, _super);
        function StartupScript(apiName, callback) {
            var Map = {
                classId: 0x00000432,
                methods: {
                    getScriptOptions: { id: 0, result: "cmd,params,waitFor,timeout" },
                    setScriptOptions: { id: 1, params: "cmd,params,waitFor,timeout" },
                    testExecute: { id: 2, params: "cmd,params,waitFor,timeout" }
                }
            };
            _super.call(this, undefined, Map, adrem[apiName].AppServerObject, callback);
        }
        return StartupScript;
    })(adrem.RemoteObjProxy);
    adrem.StartupScript = StartupScript;
    var ReportGenerator = (function (_super) {
        __extends(ReportGenerator, _super);
        function ReportGenerator(apiName, callback) {
            var Map = {
                classId: 0x00000402,
                methods: {
                    openPregeneratedReports: { id: 1, params: "repObjId,reportType,reportId" },
                    getPregeneratedReports: { id: 2, params: "reqHandle", result: "completed,count" },
                    closePregeneratedReports: { id: 3, params: "reqHandle" },
                    generateReport: { id: 12, params: "reportId,repObjId,reportType,period,startDate,forceGenerate" },
                    getGeneratorProgress: {
                        id: 6,
                        params: "repGenHandle",
                        result: "progress,operation,progressMessage,finished"
                    },
                    closeGenerator: { id: 13, params: "repGenHandle" },
                    generateReportForNodeList: { id: 8, params: "reportId,mapId,period,startDate,forceGenerate,nodeIds" },
                    deletePregeneratedReport: { id: 9, params: "reportFile" },
                    registerRepGenerator: { id: 10, params: "guid,genFileName" },
                    getAvailableDemoReportFiles: { id: 11 },
                    getRemoteReportsPath: { id: 14 }
                }
            };
            _super.call(this, undefined, Map, adrem[apiName].AppServerObject, callback);
        }
        return ReportGenerator;
    })(adrem.RemoteObjProxy);
    adrem.ReportGenerator = ReportGenerator;
    var ReportDataManager = (function (_super) {
        __extends(ReportDataManager, _super);
        function ReportDataManager(apiName, callback) {
            var Map = {
                classId: 0x00004011,
                methods: {
                    getReportGeneratorInfo: { id: 1, params: "reportId", result: "guid,exeFileName,name" },
                    getObjReports: { id: 2, params: "objId,isMap" },
                    getObjTemplateReports: { id: 3, params: "templId,objId,isMap" },
                    getAllReports: { id: 4, params: "includePrivateReports,objId,isMap,validTypesOnly" },
                    isReportEnabled: { id: 5, params: "reportId,objId,isMapObj" },
                    getReportParams: { id: 6, params: "reportId" },
                    getReportData: {
                        id: 7,
                        params: "reportId",
                        result: "isMapReport,reportName,reportParams,generatorFileName,generatorGuid"
                    },
                    getReportSchedule: { id: 8 },
                    getScheduledReports: { id: 9, params: "scheduleId" },
                    getDistributionNames: { id: 10, params: "scheduleId" },
                    getDistributionList: { id: 11, params: "scheduleId,name" },
                    getScheduleIdInfo: { id: 12, params: "scheduleId", result: "isMap,reportId,objId" },
                    isReportOverrided: { id: 13, params: "reportId,objId,isMapObj" },
                    getObjDefinedReportsNames: { id: 14 },
                    getReportGroupNames: { id: 15 }
                }
            };
            _super.call(this, undefined, Map, adrem[apiName].AppServerObject, callback);
        }
        return ReportDataManager;
    })(adrem.RemoteObjProxy);
    adrem.ReportDataManager = ReportDataManager;
    var StaticBridgeConfig = (function (_super) {
        __extends(StaticBridgeConfig, _super);
        function StaticBridgeConfig(apiName, callback) {
            var Map = {
                classId: 0x10004102,
                methods: {
                    buildPhysicalTopology: { id: 1, params: "excludedBridgeId" },
                    getAvailableNodeList: { id: 2, params: "parentBridgeId,parentPortId" },
                    getNodeParentData: { id: 3, params: "nodeId", result: "success,parentBridgeId,parentPortId" },
                    getBridgeData: {
                        id: 4,
                        params: "bridgeId",
                        result: "name,parentBridgeId,parentPortId,bridgeNodeId,portList,fdbList"
                    },
                    updateBridgeData: { id: 5, params: "bridgeId,portList,fdbList,name,parentBridgeId,parentPortId" },
                    getConfiguredBridgeList: { id: 6 },
                    updatePortFdbTree: { id: 7, params: "bridgeIds", result: "fdbList" },
                    completeParentList: { id: 8, params: "parentBridgeId,parentPortId", result: "bridgeIds,portIds" },
                    getBridgePortList: { id: 9, params: "bridgeId" },
                    getBridgeEnterMAC: { id: 10, params: "bridgeId" },
                    getBridgeIdByNodeId: { id: 11, params: "nodeId" }
                }
            };
            _super.call(this, undefined, Map, adrem[apiName].AppServerObject, callback);
        }
        return StaticBridgeConfig;
    })(adrem.RemoteObjProxy);
    adrem.StaticBridgeConfig = StaticBridgeConfig;
    var PhysicalSegments = (function (_super) {
        __extends(PhysicalSegments, _super);
        function PhysicalSegments(apiName, callback) {
            var Map = {
                classId: 0x10004101,
                methods: {
                    scanForBridges: { id: 1 },
                    configurePhysicalSegments: {
                        id: 3,
                        params: "enable,bridgeDevices,options",
                        result: "enabled,errorMessage"
                    },
                    getConfiguration: { id: 4, result: "enabled,options" },
                    changeConfiguration: { id: 5, params: "options" },
                    getBridgeNodeList: { id: 6, params: "getStaticBridges" },
                    addNewBridgeDevice: {
                        id: 7,
                        params: "nodeId,deviceAddress,snmpBridgeId,devMacAddress,deviceType,sysObjId,snmpPort,snmpProfileId,staticBridge",
                        result: "added,msg"
                    }
                }
            };
            _super.call(this, undefined, Map, adrem[apiName].AppServerObject, callback);
        }
        return PhysicalSegments;
    })(adrem.RemoteObjProxy);
    adrem.PhysicalSegments = PhysicalSegments;
    var PerfColorSchemeMgr = (function (_super) {
        __extends(PerfColorSchemeMgr, _super);
        function PerfColorSchemeMgr(apiName, callback) {
            var Map = {
                classId: 0x77730400,
                methods: {
                    loadScheme: { id: 1, params: "id" },
                    getList: { id: 2 },
                    delete: { id: 3, params: "id" },
                    add: { id: 4, params: "name,options" },
                    setById: { id: 5, params: "id,name,options" },
                    getIsReadOnly: { id: 6, params: "id" },
                    getName: { id: 7, params: "id" }
                }
            };
            _super.call(this, undefined, Map, adrem[apiName].AppServerObject, callback);
        }
        return PerfColorSchemeMgr;
    })(adrem.RemoteObjProxy);
    adrem.PerfColorSchemeMgr = PerfColorSchemeMgr;
    var ScanManager = (function (_super) {
        __extends(ScanManager, _super);
        function ScanManager(apiName, callback) {
            var Map = {
                classId: 0x77730300,
                methods: {
                    rescan: { id: 1, params: "mapId" },
                    "break": { id: 2 },
                    handleEventReply: { id: 3, params: "eventType" },
                    routingRescan: { id: 4 },
                    scanAtlas: { id: 5, params: "scanFilter,localNetwork,manualScan,winsEnabled" },
                    srvGetObjects: { id: 6, result: "break,filter,scanner,createRoutingMap" },
                    scanIpNetwork: { id: 7, params: "scanFilter,ipNetAddress,ipNetMask,netIsLocal" },
                    rescanDomain: { id: 8, params: "mapId,domainName" },
                    getDomainList: { id: 9, result: "domains,errorCode" },
                    getIpNetList: { id: 10, params: "localOnly,monitoredOnly" },
                    getScanResult: { id: 11, result: "scanListXml,createRoutingMap,currentCount,nodeLimit" }
                }
            };
            _super.call(this, undefined, Map, adrem[apiName].AppServerObject, callback);
        }
        return ScanManager;
    })(adrem.RemoteObjProxy);
    adrem.ScanManager = ScanManager;
    var AdvMonLevelServiceEditorHelper = (function (_super) {
        __extends(AdvMonLevelServiceEditorHelper, _super);
        function AdvMonLevelServiceEditorHelper(apiName, callback) {
            var Map = {
                classId: 0x10004104,
                methods: {
                    checkHttpPageContent: { id: 1, params: "httpSchema,httpServer,httpServerPort,urlData" },
                    getHttpPageChecksum: { id: 2, params: "httpSchema,httpServer,httpServerPort,urlData" },
                    isFinished: { id: 3, result: "finished,success,result" },
                    breakRequest: { id: 4 }
                }
            };
            _super.call(this, undefined, Map, adrem[apiName].AppServerObject, callback);
        }
        return AdvMonLevelServiceEditorHelper;
    })(adrem.RemoteObjProxy);
    adrem.AdvMonLevelServiceEditorHelper = AdvMonLevelServiceEditorHelper;
    var SnmpView = (function (_super) {
        __extends(SnmpView, _super);
        function SnmpView(apiName, callback) {
            var Map = {
                classId: 0x10004103,
                methods: {
                    createView: {
                        id: 1,
                        params: "nodeId,addrOrName,snmpProfileId,port,retry,timeout,tableView,viewId,oidCount,oids"
                    },
                    removeView: { id: 2, params: "viewName" },
                    checkSnmpAvail: { id: 3, params: "nodeId,addressOrName,snmpProfileId,port,retry,timeout" },
                    getSnmpAvail: {
                        id: 4,
                        params: "reqHandle",
                        result: "success,available,devClass,devCategory,devModel"
                    },
                    setSnmpValues: { id: 5, params: "viewName,count" },
                    getSettingStatus: { id: 6, params: "viewName", result: "completed,count" },
                    breakSetting: { id: 7, params: "viewName" },
                    getSnmpDataType: { id: 8, params: "viewName,oid", result: "valid,dataType" },
                    refreshSnmpData: { id: 9, params: "viewName" },
                    getViewOverallStatus: { id: 10, params: "names" }
                }
            };
            _super.call(this, undefined, Map, adrem[apiName].AppServerObject, callback);
        }
        return SnmpView;
    })(adrem.RemoteObjProxy);
    adrem.SnmpView = SnmpView;
    var SnmpDataReader = (function (_super) {
        __extends(SnmpDataReader, _super);
        function SnmpDataReader(apiName, callback) {
            var Map = {
                classId: 0x10004100,
                methods: {
                    readSnmpVarData: { id: 1, params: "oids,highPriority,nodeProperties" },
                    readSnmpColData: { id: 2, params: "columnOid,highPriority,nodeProperties" },
                    refreshData: { id: 3, params: "reqHandle" },
                    checkData: {
                        id: 4,
                        params: "reqHandle,releaseOnFinish",
                        result: "reqCompleted,errorCode,errorOid,values"
                    },
                    closeDataRead: { id: 5, params: "reqHandle" },
                    setSnmpData: { id: 6, params: "count" } // todo: values after count
                }
            };
            _super.call(this, undefined, Map, adrem[apiName].AppServerObject, callback);
        }
        return SnmpDataReader;
    })(adrem.RemoteObjProxy);
    adrem.SnmpDataReader = SnmpDataReader;
    var NodePoliciesMembershipMgr = (function (_super) {
        __extends(NodePoliciesMembershipMgr, _super);
        function NodePoliciesMembershipMgr(apiName, callback) {
            var Map = {
                classId: 0x00000433,
                methods: {
                    applyPoliciesToNodes: { id: 1, params: "polices,nodes" },
                    deleteNodesFromPolicies: { id: 2, params: "mapNodeList" },
                    getNodeValidPolicies: { id: 3, params: "nodeId" },
                    policiesValidForNodes: { id: 4, params: "policies,nodes" }
                }
            };
            _super.call(this, undefined, Map, adrem[apiName].AppServerObject, callback);
        }
        return NodePoliciesMembershipMgr;
    })(adrem.RemoteObjProxy);
    adrem.NodePoliciesMembershipMgr = NodePoliciesMembershipMgr;
    var EventDBConsoleUtils = (function (_super) {
        __extends(EventDBConsoleUtils, _super);
        function EventDBConsoleUtils(apiName, callback) {
            var Map = {
                classId: 0x77770800,
                methods: {
                    invalidateCache: { id: 1, params: "nodeList" },
                    updateNodeInfo: { id: 2, params: "nodeId" },
                    logRaaMessage: { id: 3, params: "userId,operationKind,msgSource,sessionId,msg" },
                    acknowledgeAll: { id: 4, params: "count" },
                    invalidateAcknowledged: { id: 5 },
                    notifyLookupTableChanged: { id: 6 }
                }
            };
            _super.call(this, undefined, Map, adrem[apiName].AppServerObject, callback);
        }
        return EventDBConsoleUtils;
    })(adrem.RemoteObjProxy);
    adrem.EventDBConsoleUtils = EventDBConsoleUtils;
    var EventDBClientUtils = (function (_super) {
        __extends(EventDBClientUtils, _super);
        function EventDBClientUtils(apiName, callback) {
            var Map = {
                classId: 0x77770802,
                methods: {
                    getHostInfo: { id: 1, params: "nodeId", result: "success,name,address" },
                    getEventUpdates: { id: 2, params: "eventId,revision", result: "state,revision,event,actionLog" },
                    acknowledgeEvent: { id: 3, params: "eventIdList" }
                }
            };
            _super.call(this, undefined, Map, adrem[apiName].AppServerObject, callback);
        }
        return EventDBClientUtils;
    })(adrem.RemoteObjProxy);
    adrem.EventDBClientUtils = EventDBClientUtils;
    var NcWebEventStats = (function (_super) {
        __extends(NcWebEventStats, _super);
        function NcWebEventStats(apiName, callback) {
            var Map = {
                classId: 0x77780000,
                methods: {
                    getGlobalStats: { id: 1 } // todo: complex result
                }
            };
            _super.call(this, undefined, Map, adrem[apiName].AppServerObject, callback);
        }
        return NcWebEventStats;
    })(adrem.RemoteObjProxy);
    adrem.NcWebEventStats = NcWebEventStats;
    var TestActionIntf = (function (_super) {
        __extends(TestActionIntf, _super);
        function TestActionIntf(apiName, callback) {
            var Map = {
                classId: 0x00005022,
                methods: {
                    runAction: { id: 1, params: "actionClassId,params" },
                    cancelRunAction: { id: 2, params: "uniqueActionId" },
                    getLogMessages: { id: 4 }
                }
            };
            _super.call(this, undefined, Map, adrem[apiName].AppServerObject, callback);
        }
        return TestActionIntf;
    })(adrem.RemoteObjProxy);
    adrem.TestActionIntf = TestActionIntf;
    var SvcMonitorIntf = (function (_super) {
        __extends(SvcMonitorIntf, _super);
        function SvcMonitorIntf(apiName, callback) {
            var Map = {
                classId: 0x00006211,
                methods: {
                    stats: { id: 1 },
                    getAvailableInstances: { id: 2, params: "nodeId,protocol,treatAsProtocolId" },
                    updateLevelParams: { id: 3, params: "svcIndex,params" },
                    getExtendedMonLevelMessage: {
                        id: 4,
                        params: "svcHandle,svcMonId,svcName,levelId,messageId,msgInfoList"
                    },
                    count: { id: 5 },
                    getServiceInfo: {
                        id: 6,
                        params: "svcName,nodeId",
                        result: "id,status,disableReason,totalProblesSent,totalReceived,lastSent,lastReceived,protocol,info,timeout,hostId,repCount,additionalRepCount,monitorTime,param,smartScan,monitoringLevelId,defaultLevelParams,levelParams,isExtendedLevel"
                    },
                    updateLevelParamsById: { id: 7, params: "svcId,params" },
                    getServiceInfoByIndex: {
                        id: 8,
                        params: "index",
                        result: "id,status,disableReason,totalProblesSent,totalReceived,lastSent,lastReceived,protocol,info,timeout,hostId,repCount,additionalRepCount,monitorTime,param,smartScan,monitoringLevelId,defaultLevelParams,levelParams,isExtendedLevel"
                    },
                    matchSvcDataWithRegularExpr: { id: 9, params: "data,regExprPattern" },
                    testSvcResultPattern: { id: 10, params: "data,dataIsHex,startPos,endPos,comp,pattern,patternFormat" },
                    checkSvcRegExpPattern: { id: 11, params: "pattern" }
                }
            };
            _super.call(this, undefined, Map, adrem[apiName].AppServerObject, callback);
        }
        return SvcMonitorIntf;
    })(adrem.RemoteObjProxy);
    adrem.SvcMonitorIntf = SvcMonitorIntf;
    var NtLogMonitor = (function (_super) {
        __extends(NtLogMonitor, _super);
        function NtLogMonitor(apiName, callback) {
            var Map = {
                classId: 0x00004099,
                methods: {
                    getMonitorConfig: { id: 1, result: "reconnectInterval,enabled,windowsForWorkgroupsMode" },
                    getFirstMonitoredNode: { id: 2, result: "success,queryParams,nodeName,enabled,nodeId" },
                    getNextMonitoredNode: { id: 3, result: "success,queryParams,nodeName,enabled,nodeId" },
                    getFirstChangedNode: { id: 4, result: "success,queryParams,nodeName,enabled,nodeId" },
                    getNextChangedNode: { id: 5, result: "success,queryParams,nodeName,enabled,nodeId" },
                    nodeStateChanged: { id: 6, params: "nodeId,nodeState,errorMessage" },
                    monitorStateChanged: { id: 7, params: "monitorState" },
                    logEntryReceived: { id: 8, params: "nodeId,message,params" },
                    logFileListReceived: { id: 9, params: "nodeId,list" },
                    getNextDeletedNode: { id: 10, params: "success,nodeId" } // todo: no data at all when success is false
                }
            };
            _super.call(this, undefined, Map, adrem[apiName].AppServerObject, callback);
        }
        return NtLogMonitor;
    })(adrem.RemoteObjProxy);
    adrem.NtLogMonitor = NtLogMonitor;
    var NcMonitor = (function (_super) {
        __extends(NcMonitor, _super);
        function NcMonitor(apiName, callback) {
            var Map = {
                classId: 0x00000420,
                methods: {
                    getCurrentAtlasId: { id: 1 },
                    getCurrentAtlasDataPath: { id: 2 },
                    getPerformanceCounterSources: { id: 3 },
                    getNetCrunchDataPath: { id: 4 },
                    getNetCrunchInstallPath: { id: 84 },
                    getCurrentAtlasDateCreated: { id: 5 },
                    getCurrentAtlasInfo: {
                        id: 6,
                        result: "id,name,dataPath,dateCreated,enabled,disabledFrom,disabledUntil,simulated"
                    },
                    getCurrentAtlasName: { id: 7 },
                    getWebConfig: { id: 8, result: "enabled,useSsl,port,configured" },
                    getIsMonitoringEnabled: { id: 9 },
                    getCurrentAtlasLoaded: { id: 10 },
                    getCurrentAtlasDefaultGateway: { id: 11 },
                    getCurrentAtlasIsSimulated: { id: 12 },
                    suspendHostMonitor: { id: 13 },
                    resumeNameResolving: { id: 14 },
                    clearPendingAlerts: { id: 15, params: "len" },
                    getLocalInterfaceList: { id: 18 },
                    getLocalServerPort: { id: 17 },
                    getSNMPTrapOptions: {
                        id: 20,
                        result: "active,port,redirect,redirectHost,redirectPort,group,groupTime"
                    },
                    setSNMPTrapOptions: {
                        id: 21,
                        params: "active,port,redirect,redirectHost,redirectPort,group,groupTime"
                    },
                    getSNMPTrapStatus: { id: 22, result: "active,configPending,errorMessage" },
                    getSyslogOptions: {
                        id: 30,
                        result: "active,port,redirect,redirectHost,redirectPort,group,groupTime"
                    },
                    setSyslogOptions: {
                        id: 31,
                        params: "active,port,redirect,redirectHost,redirectPort,group,groupTime"
                    },
                    getSyslogStatus: { id: 32, result: "active,errorMessage" },
                    getNcPerfProfiles: { id: 40 },
                    setNcPerfProfile: { id: 41, params: "profileId" },
                    getNetCrunchNode: { id: 47 },
                    setNetCrunchNode: { id: 48, params: "value" },
                    getAutoTrendExport: { id: 49 },
                    setAutoTrendExport: { id: 50 },
                    getUseDirectDNSResolver: { id: 51 },
                    setUseDirectDNSResolver: { id: 52 },
                    getOptionsValues: { id: 60, params: "atlasId,name" },
                    setOptionsValues: { id: 61, params: "atlasId,name,values" },
                    getAutoSelectNcNode: { id: 53 },
                    setAutoSelectNcNode: { id: 54, params: "value" },
                    backupAtlas: {
                        id: 70,
                        params: "atlasId,method,options",
                        result: "backupFileName,errorMessage,operationLog"
                    },
                    restoreAtlas: {
                        id: 71,
                        params: "atlasId,method,options",
                        result: "errorMessage,operationLog,restoredAtlasId,userFilesToCopy"
                    },
                    getBackupsList: { id: 72, params: "atlasId" },
                    getBackupedAtlasInfo: { id: 73, params: "backupFileName", result: "atlasInfo,backupOptions" },
                    deleteBackupFile: { id: 74, params: "fileName" },
                    getGlobalOption: { id: 75, params: "optionName" },
                    setGlobalOption: { id: 76, params: "optionName,data" },
                    webAccessConfigChanged: { id: 77, params: "portChanged", result: "success,errorMessage" },
                    isNetworkSimulationMode: { id: 78 },
                    needDemoAtlasUpdate: { id: 79, params: "version", result: "fileNames,result" },
                    isServiceRunning: { id: 80, params: "serviceName", result: "errorMessage,result" },
                    isPortAvailable: { id: 81, params: "port" },
                    startService: { id: 82, params: "serviceName", result: "errorMessage,result" },
                    deleteLogFile: { id: 85, params: "fileName", result: "errorMessage,result" },
                    getServerIPAddressList: { id: 83, result: "defaultNCAddress,ipAddressList" },
                    getServerSystemVersion: { id: 86, result: "majorVersion,minorVersion,buildNumber" },
                    setIssue: { id: 87, params: "source,category,msg,errorCode" },
                    clearIssue: { id: 88, params: "source,category,errorCode" },
                    getWindowsForWorkgroupMode: { id: 89 },
                    serverSendMail: {
                        id: 90,
                        params: "sendToList,subject,textMsgBodt,fileName",
                        result: "result,errorMessage"
                    }
                }
            };
            _super.call(this, undefined, Map, adrem[apiName].AppServerObject, callback);
        }
        return NcMonitor;
    })(adrem.RemoteObjProxy);
    adrem.NcMonitor = NcMonitor;
    var NCMonitorData = (function (_super) {
        __extends(NCMonitorData, _super);
        function NCMonitorData() {
            _super.apply(this, arguments);
            this.monitorId = 0;
            this.appMonitorName = '';
            this.displayName = '';
            this.counterGroup = '';
            this.monitorFlags = 0;
            this.hasNodeSource = false;
            this.perfMonName = '';
            this.counterTypeName = '';
            this.counterSrcName = '';
            this.isPerSecSupported = false;
            this.shortDisplayName = '';
        }
        NCMonitorData.fieldOrder = ['monitorId', 'appMonitorName', 'displayName', 'counterGroup', 'monitorFlags', 'hasNodeSource', 'perfMonName', 'counterTypeName', 'counterSrcName', 'isPerSecSupported', 'shortDisplayName'];
        return NCMonitorData;
    })(ConvertedData);
    adrem.NCMonitorData = NCMonitorData;
    var MonitorMgrIntf = (function (_super) {
        __extends(MonitorMgrIntf, _super);
        function MonitorMgrIntf(apiName, callback) {
            var Map = {
                classId: 0x0002302F,
                methods: {
                    getMonitorsInfo: { id: 1 },
                    getSelMonitorsInfo: { id: 2, params: "monList" },
                    getAppMonNodeStatus: { id: 3, params: "monIndex,nodeId" },
                    getNodeMonitoringState: { id: 4, params: "monIndex,nodeId" },
                    getNodeMonitoringTime: { id: 5, params: "monIndex,nodeId" },
                    getStatus: { id: 6, params: "monIndex,nodeId" },
                    isNodeMonitored: { id: 7, params: "monIndex,nodeId" },
                    getMonitoredCounters: { id: 8, params: "monitor,nodeId" },
                    perform: { id: 9, params: "monIndex,method,data" },
                    isVirtualCounterUsed: { id: 10, params: "cntPath" }
                }
            };
            _super.call(this, undefined, Map, adrem[apiName].AppServerObject, callback);
            this.getMonitorsInfo = this.getMonitorsInfoWrapper(this.getMonitorsInfo);
        }
        MonitorMgrIntf.prototype.getMonitorsInfoWrapper = function (getMonitorsInfo) {
            var dataConverter = new DataConverter(NCMonitorData);
            return function (params, callback) {
                getMonitorsInfo(params, function (monitorData) {
                    var convertedData;
                    convertedData = dataConverter.convertData(monitorData);
                    callback(convertedData);
                });
            };
        };
        MonitorMgrIntf.prototype.convertMonitorsInfoListToMap = function (monitors) {
            var monitorsMap = Object.create(null);
            monitors.forEach(function (monitor) {
                monitorsMap[monitor.monitorId] = monitor;
            });
            monitorsMap.monitors = monitors;
            return monitorsMap;
        };
        return MonitorMgrIntf;
    })(adrem.RemoteObjProxy);
    adrem.MonitorMgrIntf = MonitorMgrIntf;
    var MonitoringOptimizer = (function (_super) {
        __extends(MonitoringOptimizer, _super);
        function MonitoringOptimizer(apiName, callback) {
            var Map = {
                classId: 0x00000430,
                methods: {
                    getMonitoringOptimization: { id: 1 },
                    setMonitoringOptimization: { id: 2, params: "optimizationType" }
                }
            };
            _super.call(this, undefined, Map, adrem[apiName].AppServerObject, callback);
        }
        return MonitoringOptimizer;
    })(adrem.RemoteObjProxy);
    adrem.MonitoringOptimizer = MonitoringOptimizer;
    var CommonEventMgrHelper = (function (_super) {
        __extends(CommonEventMgrHelper, _super);
        function CommonEventMgrHelper(apiName, callback) {
            var Map = {
                classId: 0x10004203,
                methods: {
                    getSeverities: { id: 1 },
                    getApplications: { id: 2 },
                    getMapRuleIds: { id: 3, params: "mapId" },
                    getNodeRulesRequirements: { id: 4, params: "nodeId,requirementType" },
                    isAlertEnabled: { id: 5, params: "ruleId,nodeId" },
                    getAllClasses: { id: 7 },
                    getAllRules: { id: 8 } // todo: complex result
                }
            };
            _super.call(this, undefined, Map, adrem[apiName].AppServerObject, callback);
        }
        return CommonEventMgrHelper;
    })(adrem.RemoteObjProxy);
    adrem.CommonEventMgrHelper = CommonEventMgrHelper;
    var ActionHost = (function (_super) {
        __extends(ActionHost, _super);
        function ActionHost(apiName, hostExeName, processId, callback) {
            var Map = {
                classId: 0x77740600,
                methods: {
                    actionFinishedNotification: { id: 1, params: "dispatcherActionId" },
                    reportActionsIssue: { id: 2, params: "issueType,errorMessage,actionClassId" },
                    writeActionLog: { id: 3, params: "uniqueActionId,eventId,escalationTime,source,message" },
                    updateEventData: { id: 4, params: "dispatcherActionId,eventId,dataType,value" },
                    clearActionsIssue: { id: 5, params: "actionIssueType" },
                    getCurrentAtlasId: { id: 6 }
                }
            };
            _super.call(this, undefined, Map, adrem[apiName].AppServerObject, callback);
        }
        return ActionHost;
    })(adrem.RemoteObjProxy);
    adrem.ActionHost = ActionHost;
    var ActionsHelper = (function (_super) {
        __extends(ActionsHelper, _super);
        function ActionsHelper(apiName, callback) {
            var Map = {
                classId: 0x06004002,
                methods: {
                    actionFinishedNotification: { id: 2 },
                    logActionMessage: { id: 3 },
                    acknowledgeEvents: { id: 9, params: "eventsIds" },
                    sendGlobalNotification: { id: 12, params: "notifyName,param" },
                    getNetCrunchNodeId: { id: 15 },
                    clearPendingByEvRuleId: { id: 17, params: "nodeId,eventRuleCount" },
                    updateEventData: { id: 18, params: "dispatcherActionId,eventId,dataType,value" },
                    getSeverityList: { id: 21 }
                }
            };
            _super.call(this, undefined, Map, adrem[apiName].AppServerObject, callback);
        }
        return ActionsHelper;
    })(adrem.RemoteObjProxy);
    adrem.ActionsHelper = ActionsHelper;
    var NcAsSrvAgentRequester = (function (_super) {
        __extends(NcAsSrvAgentRequester, _super);
        function NcAsSrvAgentRequester(apiName, callback) {
            var Map = {
                classId: 0x00005100,
                methods: {
                    getRequest: { id: 1 },
                    putRequestResult: { id: 2, params: "requestId" }
                }
            };
            _super.call(this, undefined, Map, adrem[apiName].AppServerObject, callback);
        }
        return NcAsSrvAgentRequester;
    })(adrem.RemoteObjProxy);
    adrem.NcAsSrvAgentRequester = NcAsSrvAgentRequester;
    var DataConverter = (function () {
        function DataConverter(dataType) {
            this.dataType = dataType;
            this.fieldCount = this.dataType.fieldOrder.length;
        }
        DataConverter.prototype.parseRecord = function (record) {
            var parsedRecord = new this.dataType();
            this.dataType.fieldOrder.forEach(function (field, index) {
                parsedRecord[field] = record[index];
            });
            return parsedRecord;
        };
        DataConverter.prototype.convertData = function (data) {
            var parsedData = [];
            while (data.length > 0) {
                parsedData.push(this.parseRecord(data.splice(0, this.fieldCount)));
            }
            return parsedData;
        };
        return DataConverter;
    })();
})(adrem || (adrem = {}));
//# sourceMappingURL=NCObjects.js.map