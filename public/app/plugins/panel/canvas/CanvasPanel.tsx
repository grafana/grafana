import { Component } from 'react';
import * as React from 'react';
import { ReplaySubject, Subscription } from 'rxjs';

import { PanelProps } from '@grafana/data';
import { locationService } from '@grafana/runtime/src';
import { PanelContext, PanelContextRoot } from '@grafana/ui';
import { CanvasFrameOptions } from 'app/features/canvas/frame';
import { ElementState } from 'app/features/canvas/runtime/element';
import { Scene } from 'app/features/canvas/runtime/scene';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { PanelEditEnteredEvent, PanelEditExitedEvent } from 'app/types/events';

import { SetBackground } from './components/SetBackground';
import { InlineEdit } from './editor/inline/InlineEdit';
import { Options } from './panelcfg.gen';
import { AnchorPoint, CanvasTooltipPayload, ConnectionState } from './types';

interface Props extends PanelProps<Options> {}

interface State {
  refresh: number;
  openInlineEdit: boolean;
  openSetBackground: boolean;
  contextMenuAnchorPoint: AnchorPoint;
  moveableAction: boolean;
}

export interface InstanceState {
  scene: Scene;
  selected: ElementState[];
  selectedConnection?: ConnectionState;
}

export interface SelectionAction {
  panel: CanvasPanel;
}

let canvasInstances: CanvasPanel[] = [];
let activeCanvasPanel: CanvasPanel | undefined = undefined;
let isInlineEditOpen = false;
let isSetBackgroundOpen = false;

export const activePanelSubject = new ReplaySubject<SelectionAction>(1);

export class CanvasPanel extends Component<Props, State> {
  declare context: React.ContextType<typeof PanelContextRoot>;
  static contextType = PanelContextRoot;
  panelContext: PanelContext | undefined;

  readonly scene: Scene;
  private subs = new Subscription();
  needsReload = false;
  isEditing = locationService.getSearchObject().editPanel !== undefined;

  constructor(props: Props) {
    super(props);
    this.state = {
      refresh: 0,
      openInlineEdit: false,
      openSetBackground: false,
      contextMenuAnchorPoint: { x: 0, y: 0 },
      moveableAction: false,
    };

    // TODO: Will need to update this approach for dashboard scenes
    // migration (new dashboard edit experience)
    const dashboard = getDashboardSrv().getCurrent();
    const allowEditing = this.props.options.inlineEditing && dashboard?.editable;

    // Only the initial options are ever used.
    // later changes are all controlled by the scene
    this.scene = new Scene(
      this.props.options.root,
      allowEditing,
      this.props.options.showAdvancedTypes,
      this.props.options.panZoom,
      this.props.options.infinitePan,
      this.onUpdateScene,
      this
    );
    this.scene.updateSize(props.width, props.height);
    this.scene.updateData(props.data);
    this.scene.inlineEditingCallback = this.openInlineEdit;
    this.scene.setBackgroundCallback = this.openSetBackground;
    this.scene.tooltipCallback = this.tooltipCallback;
    this.scene.moveableActionCallback = this.moveableActionCallback;

    this.subs.add(
      this.props.eventBus.subscribe(PanelEditEnteredEvent, (evt: PanelEditEnteredEvent) => {
        // Remove current selection when entering edit mode for any panel in dashboard
        this.scene.clearCurrentSelection();
        this.closeInlineEdit();
      })
    );

    this.subs.add(
      this.props.eventBus.subscribe(PanelEditExitedEvent, (evt: PanelEditExitedEvent) => {
        if (this.props.id === evt.payload) {
          this.needsReload = true;
          this.scene.clearCurrentSelection();
        }
      })
    );
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

      this.subs.add(
        this.scene.selection.subscribe({
          next: (v) => {
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

            this.panelContext?.onInstanceStateChange!({
              scene: this.scene,
              selected: v,
              layer: this.scene.root,
            });
          },
        })
      );

      this.subs.add(
        this.scene.connections.selection.subscribe({
          next: (v) => {
            if (!this.context.instanceState) {
              return;
            }

            this.panelContext?.onInstanceStateChange!({
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
        })
      );
    }

    canvasInstances.push(this);
  }

  componentWillUnmount() {
    this.scene.subscription.unsubscribe();
    this.subs.unsubscribe();
    isInlineEditOpen = false;
    isSetBackgroundOpen = false;
    canvasInstances = canvasInstances.filter((ci) => ci.props.id !== activeCanvasPanel?.props.id);
  }

  // NOTE, all changes to the scene flow through this function
  // even the editor gets current state from the same scene instance!
  onUpdateScene = (root: CanvasFrameOptions) => {
    const { onOptionsChange, options } = this.props;
    onOptionsChange({
      ...options,
      root,
    });

    this.setState({ refresh: this.state.refresh + 1 });
    activePanelSubject.next({ panel: this });
  };

  shouldComponentUpdate(nextProps: Props, nextState: State) {
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
    const shouldShowAdvancedTypesSwitched =
      this.props.options.showAdvancedTypes !== nextProps.options.showAdvancedTypes;
    const panZoomSwitched = this.props.options.panZoom !== nextProps.options.panZoom;
    const infinitePanSwitched = this.props.options.infinitePan !== nextProps.options.infinitePan;
    if (
      this.needsReload ||
      inlineEditingSwitched ||
      shouldShowAdvancedTypesSwitched ||
      panZoomSwitched ||
      infinitePanSwitched
    ) {
      if (inlineEditingSwitched) {
        // Replace scene div to prevent selecto instance leaks
        this.scene.revId++;
      }

      this.needsReload = false;
      this.scene.load(
        nextProps.options.root,
        nextProps.options.inlineEditing,
        nextProps.options.showAdvancedTypes,
        nextProps.options.panZoom,
        nextProps.options.infinitePan
      );
      this.scene.updateSize(nextProps.width, nextProps.height);
      this.scene.updateData(nextProps.data);
      changed = true;
    }

    return changed;
  }

  openInlineEdit = () => {
    if (isInlineEditOpen) {
      this.forceUpdate();
      this.setActivePanel();
      return;
    }

    this.setActivePanel();
    this.setState({ openInlineEdit: true });
    isInlineEditOpen = true;
  };

  openSetBackground = (anchorPoint: AnchorPoint) => {
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

  tooltipCallback = (tooltip: CanvasTooltipPayload | undefined) => {
    this.scene.tooltip = tooltip;
    this.forceUpdate();
  };

  moveableActionCallback = (updated: boolean) => {
    this.setState({ moveableAction: updated });
    this.forceUpdate();
  };

  closeInlineEdit = () => {
    this.setState({ openInlineEdit: false });
    isInlineEditOpen = false;
  };

  closeSetBackground = () => {
    this.setState({ openSetBackground: false });
    isSetBackgroundOpen = false;
  };

  setActivePanel = () => {
    activeCanvasPanel = this;
    activePanelSubject.next({ panel: this });
  };

  renderInlineEdit = () => {
    return <InlineEdit onClose={() => this.closeInlineEdit()} id={this.props.id} scene={this.scene} />;
  };

  renderSetBackground = () => {
    return (
      <SetBackground
        onClose={() => this.closeSetBackground()}
        scene={this.scene}
        anchorPoint={this.state.contextMenuAnchorPoint}
      />
    );
  };

  render() {
    return (
      <>
        {this.scene.render()}
        {this.state.openInlineEdit && this.renderInlineEdit()}
        {this.state.openSetBackground && this.renderSetBackground()}
      </>
    );
  }
}
