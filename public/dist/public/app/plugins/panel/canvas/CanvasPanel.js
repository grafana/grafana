import React, { Component } from 'react';
import { ReplaySubject, Subscription } from 'rxjs';
import { locationService } from '@grafana/runtime/src';
import { PanelContextRoot } from '@grafana/ui';
import { Scene } from 'app/features/canvas/runtime/scene';
import { PanelEditEnteredEvent, PanelEditExitedEvent } from 'app/types/events';
import { SetBackground } from './components/SetBackground';
import { InlineEdit } from './editor/inline/InlineEdit';
let canvasInstances = [];
let activeCanvasPanel = undefined;
let isInlineEditOpen = false;
let isSetBackgroundOpen = false;
export const activePanelSubject = new ReplaySubject(1);
export class CanvasPanel extends Component {
    constructor(props) {
        super(props);
        this.subs = new Subscription();
        this.needsReload = false;
        this.isEditing = locationService.getSearchObject().editPanel !== undefined;
        // NOTE, all changes to the scene flow through this function
        // even the editor gets current state from the same scene instance!
        this.onUpdateScene = (root) => {
            const { onOptionsChange, options } = this.props;
            onOptionsChange(Object.assign(Object.assign({}, options), { root }));
            this.setState({ refresh: this.state.refresh + 1 });
            activePanelSubject.next({ panel: this });
        };
        this.openInlineEdit = () => {
            if (isInlineEditOpen) {
                this.forceUpdate();
                this.setActivePanel();
                return;
            }
            this.setActivePanel();
            this.setState({ openInlineEdit: true });
            isInlineEditOpen = true;
        };
        this.openSetBackground = (anchorPoint) => {
            if (isSetBackgroundOpen) {
                this.forceUpdate();
                this.setActivePanel();
                return;
            }
            this.setActivePanel();
            this.setState({ openSetBackground: true });
            this.setState({ contextMenuAnchorPoint: anchorPoint });
            isSetBackgroundOpen = true;
        };
        this.tooltipCallback = (tooltip) => {
            this.scene.tooltip = tooltip;
            this.forceUpdate();
        };
        this.moveableActionCallback = (updated) => {
            this.setState({ moveableAction: updated });
            this.forceUpdate();
        };
        this.closeInlineEdit = () => {
            this.setState({ openInlineEdit: false });
            isInlineEditOpen = false;
        };
        this.closeSetBackground = () => {
            this.setState({ openSetBackground: false });
            isSetBackgroundOpen = false;
        };
        this.setActivePanel = () => {
            activeCanvasPanel = this;
            activePanelSubject.next({ panel: this });
        };
        this.renderInlineEdit = () => {
            return React.createElement(InlineEdit, { onClose: () => this.closeInlineEdit(), id: this.props.id, scene: this.scene });
        };
        this.renderSetBackground = () => {
            return (React.createElement(SetBackground, { onClose: () => this.closeSetBackground(), scene: this.scene, anchorPoint: this.state.contextMenuAnchorPoint }));
        };
        this.state = {
            refresh: 0,
            openInlineEdit: false,
            openSetBackground: false,
            contextMenuAnchorPoint: { x: 0, y: 0 },
            moveableAction: false,
        };
        // Only the initial options are ever used.
        // later changes are all controlled by the scene
        this.scene = new Scene(this.props.options.root, this.props.options.inlineEditing, this.props.options.showAdvancedTypes, this.onUpdateScene, this);
        this.scene.updateSize(props.width, props.height);
        this.scene.updateData(props.data);
        this.scene.inlineEditingCallback = this.openInlineEdit;
        this.scene.setBackgroundCallback = this.openSetBackground;
        this.scene.tooltipCallback = this.tooltipCallback;
        this.scene.moveableActionCallback = this.moveableActionCallback;
        this.subs.add(this.props.eventBus.subscribe(PanelEditEnteredEvent, (evt) => {
            // Remove current selection when entering edit mode for any panel in dashboard
            this.scene.clearCurrentSelection();
            this.closeInlineEdit();
        }));
        this.subs.add(this.props.eventBus.subscribe(PanelEditExitedEvent, (evt) => {
            if (this.props.id === evt.payload) {
                this.needsReload = true;
                this.scene.clearCurrentSelection();
            }
        }));
    }
    componentDidMount() {
        activeCanvasPanel = this;
        activePanelSubject.next({ panel: this });
        this.panelContext = this.context;
        if (this.panelContext.onInstanceStateChange) {
            this.panelContext.onInstanceStateChange({
                scene: this.scene,
                layer: this.scene.root,
            });
            this.subs.add(this.scene.selection.subscribe({
                next: (v) => {
                    var _a;
                    if (v.length) {
                        activeCanvasPanel = this;
                        activePanelSubject.next({ panel: this });
                    }
                    canvasInstances.forEach((canvasInstance) => {
                        if (canvasInstance !== activeCanvasPanel) {
                            canvasInstance.scene.clearCurrentSelection(true);
                            canvasInstance.scene.connections.select(undefined);
                        }
                    });
                    (_a = this.panelContext) === null || _a === void 0 ? void 0 : _a.onInstanceStateChange({
                        scene: this.scene,
                        selected: v,
                        layer: this.scene.root,
                    });
                },
            }));
            this.subs.add(this.scene.connections.selection.subscribe({
                next: (v) => {
                    var _a;
                    if (!this.context.instanceState) {
                        return;
                    }
                    (_a = this.panelContext) === null || _a === void 0 ? void 0 : _a.onInstanceStateChange({
                        scene: this.scene,
                        selected: this.context.instanceState.selected,
                        selectedConnection: v,
                        layer: this.scene.root,
                    });
                    if (v) {
                        activeCanvasPanel = this;
                        activePanelSubject.next({ panel: this });
                    }
                    canvasInstances.forEach((canvasInstance) => {
                        if (canvasInstance !== activeCanvasPanel) {
                            canvasInstance.scene.clearCurrentSelection(true);
                            canvasInstance.scene.connections.select(undefined);
                        }
                    });
                    setTimeout(() => {
                        this.forceUpdate();
                    });
                },
            }));
        }
        canvasInstances.push(this);
    }
    componentWillUnmount() {
        this.scene.subscription.unsubscribe();
        this.subs.unsubscribe();
        isInlineEditOpen = false;
        isSetBackgroundOpen = false;
        canvasInstances = canvasInstances.filter((ci) => ci.props.id !== (activeCanvasPanel === null || activeCanvasPanel === void 0 ? void 0 : activeCanvasPanel.props.id));
    }
    shouldComponentUpdate(nextProps, nextState) {
        const { width, height, data, options } = this.props;
        let changed = false;
        if (width !== nextProps.width || height !== nextProps.height) {
            this.scene.updateSize(nextProps.width, nextProps.height);
            changed = true;
        }
        if (data !== nextProps.data && !this.scene.ignoreDataUpdate) {
            this.scene.updateData(nextProps.data);
            changed = true;
        }
        if (options !== nextProps.options && !this.scene.ignoreDataUpdate) {
            this.scene.updateData(nextProps.data);
            changed = true;
        }
        if (this.state.refresh !== nextState.refresh) {
            changed = true;
        }
        if (this.state.openInlineEdit !== nextState.openInlineEdit) {
            changed = true;
        }
        if (this.state.openSetBackground !== nextState.openSetBackground) {
            changed = true;
        }
        if (this.state.moveableAction !== nextState.moveableAction) {
            changed = true;
        }
        // After editing, the options are valid, but the scene was in a different panel or inline editing mode has changed
        const inlineEditingSwitched = this.props.options.inlineEditing !== nextProps.options.inlineEditing;
        const shouldShowAdvancedTypesSwitched = this.props.options.showAdvancedTypes !== nextProps.options.showAdvancedTypes;
        if (this.needsReload || inlineEditingSwitched || shouldShowAdvancedTypesSwitched) {
            if (inlineEditingSwitched) {
                // Replace scene div to prevent selecto instance leaks
                this.scene.revId++;
            }
            this.needsReload = false;
            this.scene.load(nextProps.options.root, nextProps.options.inlineEditing, nextProps.options.showAdvancedTypes);
            this.scene.updateSize(nextProps.width, nextProps.height);
            this.scene.updateData(nextProps.data);
            changed = true;
        }
        return changed;
    }
    render() {
        return (React.createElement(React.Fragment, null,
            this.scene.render(),
            this.state.openInlineEdit && this.renderInlineEdit(),
            this.state.openSetBackground && this.renderSetBackground()));
    }
}
CanvasPanel.contextType = PanelContextRoot;
//# sourceMappingURL=CanvasPanel.js.map