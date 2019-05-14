import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import Remarkable from 'remarkable';
import { getBackendSrv } from '../../services/backend_srv';
var PluginHelp = /** @class */ (function (_super) {
    tslib_1.__extends(PluginHelp, _super);
    function PluginHelp() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            isError: false,
            isLoading: false,
            help: '',
        };
        _this.loadHelp = function () {
            var _a = _this.props, plugin = _a.plugin, type = _a.type;
            _this.setState({ isLoading: true });
            getBackendSrv()
                .get("/api/plugins/" + plugin.id + "/markdown/" + type)
                .then(function (response) {
                var markdown = new Remarkable();
                var helpHtml = markdown.render(response);
                if (response === '' && type === 'help') {
                    _this.setState({
                        isError: false,
                        isLoading: false,
                        help: _this.constructPlaceholderInfo(),
                    });
                }
                else {
                    _this.setState({
                        isError: false,
                        isLoading: false,
                        help: helpHtml,
                    });
                }
            })
                .catch(function () {
                _this.setState({
                    isError: true,
                    isLoading: false,
                });
            });
        };
        return _this;
    }
    PluginHelp.prototype.componentDidMount = function () {
        this.loadHelp();
    };
    PluginHelp.prototype.constructPlaceholderInfo = function () {
        return 'No plugin help or readme markdown file was found';
    };
    PluginHelp.prototype.render = function () {
        var type = this.props.type;
        var _a = this.state, isError = _a.isError, isLoading = _a.isLoading, help = _a.help;
        if (isLoading) {
            return React.createElement("h2", null, "Loading help...");
        }
        if (isError) {
            return React.createElement("h3", null, "'Error occurred when loading help'");
        }
        if (type === 'panel_help' && help === '') {
        }
        return React.createElement("div", { className: "markdown-html", dangerouslySetInnerHTML: { __html: help } });
    };
    return PluginHelp;
}(PureComponent));
export { PluginHelp };
//# sourceMappingURL=PluginHelp.js.map