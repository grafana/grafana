import { Component } from 'react';
import { PanelProps } from '@grafana/data';
import { PanelOptions } from './models.gen';
import { Subscription } from 'rxjs';
import { PanelEditExitedEvent, PanelOptionsReloadEvent } from 'app/types/events';
import { CanvasGroupOptions } from 'app/features/canvas';
import { Scene } from 'app/features/canvas/runtime/scene';

interface Props extends PanelProps<PanelOptions> {}

interface State {
  refresh: number;
}

// Used to pass the scene to the editor functions
export let lastLoadedScene: Scene | undefined = undefined;

export class CanvasPanel extends Component<Props, State> {
  readonly scene: Scene;
  private subs = new Subscription();
  needsReload = false;

  constructor(props: Props) {
    super(props);
    this.state = {
      refresh: 0,
    };

    // Only the initial options are ever used.
    // later changs are all controled by the scene
    this.scene = lastLoadedScene = new Scene(this.props.options.root, this.onUpdateScene);
    this.scene.updateSize(props.width, props.height);
    this.scene.updateData(props.data);

    this.subs.add(
      this.props.eventBus.subscribe(PanelEditExitedEvent, (evt) => {
        if (this.props.id === evt.payload) {
          this.needsReload = true;
        }
      })
    );
  }

  componentDidMount() {
    lastLoadedScene = this.scene;
    if (window.location.href.indexOf('editPanel=') > 0) {
      console.log('componentDidMount! trigger panel options change');
      // Trigger reloading the editor... now pointing pointing to the loaded scene
      this.props.eventBus.publish(new PanelOptionsReloadEvent());

      // reload the settings when layer selection changes
      this.subs.add(
        this.scene.getSelected().subscribe({
          next: () => this.props.eventBus.publish(new PanelOptionsReloadEvent()),
        })
      );
    }
  }

  componentWillUnmount() {
    this.subs.unsubscribe();
  }

  // NOTE, all changes to the scene flow through this function
  // even the editor gets current state from the same scene instance!
  onUpdateScene = (root: CanvasGroupOptions) => {
    const { onOptionsChange, options } = this.props;
    onOptionsChange({
      ...options,
      root,
    });
    this.setState({ refresh: this.state.refresh + 1 });
    // console.log('send changes', root);
  };

  shouldComponentUpdate(nextProps: Props) {
    const { width, height, data, renderCounter } = this.props;
    let changed = false;

    if (width !== nextProps.width || height !== nextProps.height) {
      this.scene.updateSize(nextProps.width, nextProps.height);
      changed = true;
    }
    if (data !== nextProps.data) {
      this.scene.updateData(nextProps.data);
      changed = true;
    }

    // After editing, the options are valid, but the scene was in a different panel
    if (this.needsReload && this.props.options !== nextProps.options) {
      this.needsReload = false;
      this.scene.load(nextProps.options.root);
      this.scene.updateSize(nextProps.width, nextProps.height);
      this.scene.updateData(nextProps.data);
      lastLoadedScene = this.scene;
      changed = true;
    }

    if (renderCounter !== nextProps.renderCounter) {
      changed = true;
    }

    return changed;
  }

  render() {
    return this.scene.render();
  }
}
