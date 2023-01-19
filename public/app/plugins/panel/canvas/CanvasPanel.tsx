import React, { Component } from 'react';
import { ReplaySubject, Subscription } from 'rxjs';

import { PanelProps } from '@grafana/data';
import { locationService } from '@grafana/runtime/src';
import { PanelContext, PanelContextRoot } from '@grafana/ui';
import { CanvasFrameOptions } from 'app/features/canvas';
import { ElementState } from 'app/features/canvas/runtime/element';
import { Scene } from 'app/features/canvas/runtime/scene';
import { PanelEditEnteredEvent, PanelEditExitedEvent } from 'app/types/events';

import { InlineEdit } from './InlineEdit';
import { SetBackground } from './SetBackground';
import { PanelOptions } from './models.gen';
import { AnchorPoint } from './types';

interface Props extends PanelProps<PanelOptions> {}

interface State {
  refresh: number;
  openInlineEdit: boolean;
  openSetBackground: boolean;
  contextMenuAnchorPoint: AnchorPoint;
}

export interface InstanceState {
  scene: Scene;
  selected: ElementState[];
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
  panelContext: PanelContext = {} as PanelContext;

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
    };

    // Only the initial options are ever used.
    // later changes are all controlled by the scene
    this.scene = new Scene(
      this.props.options.root,
      this.props.options.inlineEditing,
      this.props.options.showAdvancedTypes,
      this.onUpdateScene,
      this
    );
    this.scene.updateSize(props.width, props.height);
    this.scene.updateData(props.data);
    this.scene.inlineEditingCallback = this.openInlineEdit;
    this.scene.setBackgroundCallback = this.openSetBackground;

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
          this.scene.load(
            this.props.options.root,
            this.props.options.inlineEditing,
            this.props.options.showAdvancedTypes
          );
        }
      })
    );
  }

  componentDidMount() {
    activeCanvasPanel = this;
    activePanelSubject.next({ panel: this });

    this.panelContext = this.context as PanelContext;
    if (this.panelContext.onInstanceStateChange) {
      this.panelContext.onInstanceStateChange({
        scene: this.scene,
        layer: this.scene.root,
      });

      this.subs.add(
        this.scene.selection.subscribe({
          next: (v) => {
            this.panelContext.onInstanceStateChange!({
              scene: this.scene,
              selected: v,
              layer: this.scene.root,
            });

            activeCanvasPanel = this;
            activePanelSubject.next({ panel: this });

            canvasInstances.forEach((canvasInstance) => {
              if (canvasInstance !== activeCanvasPanel) {
                canvasInstance.scene.clearCurrentSelection(true);
              }
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

    // After editing, the options are valid, but the scene was in a different panel or inline editing mode has changed
    const shouldUpdateSceneAndPanel = this.needsReload && this.props.options !== nextProps.options;
    const inlineEditingSwitched = this.props.options.inlineEditing !== nextProps.options.inlineEditing;
    const shouldShowAdvancedTypesSwitched =
      this.props.options.showAdvancedTypes !== nextProps.options.showAdvancedTypes;
    if (shouldUpdateSceneAndPanel || inlineEditingSwitched || shouldShowAdvancedTypesSwitched) {
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
