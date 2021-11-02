import { __assign, __extends } from "tslib";
import { Component } from 'react';
import { Subscription } from 'rxjs';
import { PanelEditEnteredEvent, PanelEditExitedEvent } from 'app/types/events';
import { Scene } from 'app/features/canvas/runtime/scene';
import { PanelContextRoot } from '@grafana/ui';
var CanvasPanel = /** @class */ (function (_super) {
    __extends(CanvasPanel, _super);
    function CanvasPanel(props) {
        var _this = _super.call(this, props) || this;
        _this.panelContext = {};
        _this.subs = new Subscription();
        _this.needsReload = false;
        // NOTE, all changes to the scene flow through this function
        // even the editor gets current state from the same scene instance!
        _this.onUpdateScene = function (root) {
            var _a = _this.props, onOptionsChange = _a.onOptionsChange, options = _a.options;
            onOptionsChange(__assign(__assign({}, options), { root: root }));
            _this.setState({ refresh: _this.state.refresh + 1 });
            // console.log('send changes', root);
        };
        _this.state = {
            refresh: 0,
        };
        // Only the initial options are ever used.
        // later changes are all controlled by the scene
        _this.scene = new Scene(_this.props.options.root, _this.props.options.inlineEditing, _this.onUpdateScene);
        _this.scene.updateSize(props.width, props.height);
        _this.scene.updateData(props.data);
        _this.subs.add(_this.props.eventBus.subscribe(PanelEditEnteredEvent, function (evt) {
            // Remove current selection when entering edit mode for any panel in dashboard
            _this.scene.clearCurrentSelection();
        }));
        _this.subs.add(_this.props.eventBus.subscribe(PanelEditExitedEvent, function (evt) {
            if (_this.props.id === evt.payload) {
                _this.needsReload = true;
            }
        }));
        return _this;
    }
    CanvasPanel.prototype.componentDidMount = function () {
        var _this = this;
        this.panelContext = this.context;
        if (this.panelContext.onInstanceStateChange) {
            this.panelContext.onInstanceStateChange({
                scene: this.scene,
                layer: this.scene.root,
            });
            this.subs.add(this.scene.selection.subscribe({
                next: function (v) {
                    _this.panelContext.onInstanceStateChange({
                        scene: _this.scene,
                        selected: v,
                        layer: _this.scene.root,
                    });
                },
            }));
        }
    };
    CanvasPanel.prototype.componentWillUnmount = function () {
        this.subs.unsubscribe();
    };
    CanvasPanel.prototype.shouldComponentUpdate = function (nextProps, nextState) {
        var _a;
        var _b = this.props, width = _b.width, height = _b.height, data = _b.data;
        var changed = false;
        if (width !== nextProps.width || height !== nextProps.height) {
            this.scene.updateSize(nextProps.width, nextProps.height);
            changed = true;
        }
        if (data !== nextProps.data) {
            this.scene.updateData(nextProps.data);
            changed = true;
        }
        if (this.state.refresh !== nextState.refresh) {
            changed = true;
        }
        // After editing, the options are valid, but the scene was in a different panel or inline editing mode has changed
        var shouldUpdateSceneAndPanel = (this.needsReload && this.props.options !== nextProps.options) ||
            this.props.options.inlineEditing !== nextProps.options.inlineEditing;
        if (shouldUpdateSceneAndPanel) {
            this.needsReload = false;
            this.scene.load(nextProps.options.root, nextProps.options.inlineEditing);
            this.scene.updateSize(nextProps.width, nextProps.height);
            this.scene.updateData(nextProps.data);
            changed = true;
            if (this.props.options.inlineEditing) {
                (_a = this.scene.selecto) === null || _a === void 0 ? void 0 : _a.destroy();
            }
        }
        return changed;
    };
    CanvasPanel.prototype.render = function () {
        return this.scene.render();
    };
    CanvasPanel.contextType = PanelContextRoot;
    return CanvasPanel;
}(Component));
export { CanvasPanel };
//# sourceMappingURL=CanvasPanel.js.map