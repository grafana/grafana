import { PureComponent } from 'react';
import { PanelProps } from '@grafana/data';
import { PanelOptions } from './models.gen';
import { Scene } from './runtime/scene';
import { CanvasGroupOptions } from './base';

interface Props extends PanelProps<PanelOptions> {}

interface State {
  refresh: number;
}

// Used to pass the scene to the editor functions
export let lastCanvasPanelInstance: CanvasPanel | undefined = undefined;

export class CanvasPanel extends PureComponent<Props, State> {
  readonly scene: Scene;

  constructor(props: Props) {
    super(props);
    this.state = {
      refresh: 0,
    };

    // Only the initial options are ever used.
    // later changs are all controled by the scene
    this.scene = new Scene(this.props.options.root, this.onUpdateScene);
    lastCanvasPanelInstance = this;
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
  };

  render() {
    return this.scene.render();
  }
}
