import { __extends } from "tslib";
import { GrafanaPlugin } from './plugin';
import { makeClassES5Compatible } from '../utils/makeClassES5Compatible';
var DataSourcePlugin = /** @class */ (function (_super) {
    __extends(DataSourcePlugin, _super);
    function DataSourcePlugin(DataSourceClass) {
        var _this = _super.call(this) || this;
        _this.DataSourceClass = DataSourceClass;
        _this.components = {};
        return _this;
    }
    DataSourcePlugin.prototype.setConfigEditor = function (editor) {
        this.components.ConfigEditor = editor;
        return this;
    };
    DataSourcePlugin.prototype.setConfigCtrl = function (ConfigCtrl) {
        this.angularConfigCtrl = ConfigCtrl;
        return this;
    };
    DataSourcePlugin.prototype.setQueryCtrl = function (QueryCtrl) {
        this.components.QueryCtrl = QueryCtrl;
        return this;
    };
    DataSourcePlugin.prototype.setAnnotationQueryCtrl = function (AnnotationsQueryCtrl) {
        this.components.AnnotationsQueryCtrl = AnnotationsQueryCtrl;
        return this;
    };
    DataSourcePlugin.prototype.setQueryEditor = function (QueryEditor) {
        this.components.QueryEditor = QueryEditor;
        return this;
    };
    DataSourcePlugin.prototype.setExploreQueryField = function (ExploreQueryField) {
        this.components.ExploreQueryField = ExploreQueryField;
        return this;
    };
    DataSourcePlugin.prototype.setExploreMetricsQueryField = function (ExploreQueryField) {
        this.components.ExploreMetricsQueryField = ExploreQueryField;
        return this;
    };
    DataSourcePlugin.prototype.setExploreLogsQueryField = function (ExploreQueryField) {
        this.components.ExploreLogsQueryField = ExploreQueryField;
        return this;
    };
    DataSourcePlugin.prototype.setQueryEditorHelp = function (QueryEditorHelp) {
        this.components.QueryEditorHelp = QueryEditorHelp;
        return this;
    };
    /**
     * @deprecated prefer using `setQueryEditorHelp`
     */
    DataSourcePlugin.prototype.setExploreStartPage = function (ExploreStartPage) {
        return this.setQueryEditorHelp(ExploreStartPage);
    };
    /*
     * @deprecated -- prefer using {@link StandardVariableSupport} or {@link CustomVariableSupport} or {@link DataSourceVariableSupport} in data source instead
     * */
    DataSourcePlugin.prototype.setVariableQueryEditor = function (VariableQueryEditor) {
        this.components.VariableQueryEditor = VariableQueryEditor;
        return this;
    };
    DataSourcePlugin.prototype.setMetadataInspector = function (MetadataInspector) {
        this.components.MetadataInspector = MetadataInspector;
        return this;
    };
    DataSourcePlugin.prototype.setComponentsFromLegacyExports = function (pluginExports) {
        this.angularConfigCtrl = pluginExports.ConfigCtrl;
        this.components.QueryCtrl = pluginExports.QueryCtrl;
        this.components.AnnotationsQueryCtrl = pluginExports.AnnotationsQueryCtrl;
        this.components.ExploreQueryField = pluginExports.ExploreQueryField;
        this.components.QueryEditor = pluginExports.QueryEditor;
        this.components.QueryEditorHelp = pluginExports.QueryEditorHelp;
        this.components.VariableQueryEditor = pluginExports.VariableQueryEditor;
    };
    return DataSourcePlugin;
}(GrafanaPlugin));
export { DataSourcePlugin };
/**
 * The main data source abstraction interface, represents an instance of a data source
 *
 * Although this is a class, datasource implementations do not *yet* need to extend it.
 * As such, we can not yet add functions with default implementations.
 */
var DataSourceApi = /** @class */ (function () {
    function DataSourceApi(instanceSettings) {
        this.name = instanceSettings.name;
        this.id = instanceSettings.id;
        this.type = instanceSettings.type;
        this.meta = {};
        this.uid = instanceSettings.uid;
        if (!this.uid) {
            this.uid = this.name; // Internal datasources do not have a UID (-- Grafana --)
        }
    }
    /** Get an identifier object for this datasource instance */
    DataSourceApi.prototype.getRef = function () {
        return { type: this.type, uid: this.uid };
    };
    return DataSourceApi;
}());
// TODO: not really needed but used as type in some data sources and in DataQueryRequest
export var ExploreMode;
(function (ExploreMode) {
    ExploreMode["Logs"] = "Logs";
    ExploreMode["Metrics"] = "Metrics";
    ExploreMode["Tracing"] = "Tracing";
})(ExploreMode || (ExploreMode = {}));
export var DataQueryErrorType;
(function (DataQueryErrorType) {
    DataQueryErrorType["Cancelled"] = "cancelled";
    DataQueryErrorType["Timeout"] = "timeout";
    DataQueryErrorType["Unknown"] = "unknown";
})(DataQueryErrorType || (DataQueryErrorType = {}));
var LanguageProvider = /** @class */ (function () {
    function LanguageProvider() {
    }
    return LanguageProvider;
}());
//@ts-ignore
LanguageProvider = makeClassES5Compatible(LanguageProvider);
export { LanguageProvider };
//@ts-ignore
DataSourceApi = makeClassES5Compatible(DataSourceApi);
export { DataSourceApi };
//# sourceMappingURL=datasource.js.map