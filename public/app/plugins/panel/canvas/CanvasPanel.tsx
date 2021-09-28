import { Component } from 'react';
import { CoreApp, PanelProps } from '@grafana/data';
import { PanelOptions } from './models.gen';
import { Subscription } from 'rxjs';
import { PanelEditExitedEvent } from 'app/types/events';
import { CanvasGroupOptions } from 'app/features/canvas';
import { Scene } from 'app/features/canvas/runtime/scene';
import { PanelContext, PanelContextRoot } from '@grafana/ui';
import { ElementState } from 'app/features/canvas/runtime/element';

interface Props extends PanelProps<PanelOptions> {}

interface State {
  refresh: number;
  transform: string;
}

export interface InstanceState {
  scene: Scene;
  selected?: ElementState;
}

export class CanvasPanel extends Component<Props, State> {
  static contextType = PanelContextRoot;
  panelContext: PanelContext = {} as PanelContext;

  readonly scene: Scene;
  private subs = new Subscription();
  private moveableRef = createRef<HTMLDivElement>();
  needsReload = false;

  constructor(props: Props) {
    super(props);
    this.state = {
      refresh: 0,
      transform: '',
    };

    // Only the initial options are ever used.
    // later changs are all controled by the scene
    this.scene = new Scene(this.props.options.root, this.onUpdateScene);
    this.scene.updateSize(props.width, props.height);
    this.scene.updateData(props.data);

    this.subs.add(
      this.props.eventBus.subscribe(PanelEditExitedEvent, (evt) => {
        if (this.props.id === evt.payload) {
          this.needsReload = true;
        }
      })
    );

    this.updateTransform = this.updateTransform.bind(this);
  }

  componentDidMount() {
    this.panelContext = this.context as PanelContext;
    if (this.panelContext.onInstanceStateChange && this.panelContext.app === CoreApp.PanelEditor) {
      this.panelContext.onInstanceStateChange({
        scene: this.scene,
      });

      this.subs.add(
        this.scene.selected.subscribe({
          next: (v) => {
            this.panelContext.onInstanceStateChange!({
              scene: this.scene,
              selected: v,
            });
          },
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

  // shouldComponentUpdate(nextProps: Props) {
  //   const { width, height, data, renderCounter } = this.props;
  //   let changed = false;

  //   if (width !== nextProps.width || height !== nextProps.height) {
  //     this.scene.updateSize(nextProps.width, nextProps.height);
  //     changed = true;
  //   }
  //   if (data !== nextProps.data) {
  //     this.scene.updateData(nextProps.data);
  //     changed = true;
  //   }

  //   // After editing, the options are valid, but the scene was in a different panel
  //   if (this.needsReload && this.props.options !== nextProps.options) {
  //     this.needsReload = false;
  //     this.scene.load(nextProps.options.root);
  //     this.scene.updateSize(nextProps.width, nextProps.height);
  //     this.scene.updateData(nextProps.data);
  //     changed = true;
  //   }

  //   if (renderCounter !== nextProps.renderCounter) {
  //     changed = true;
  //   }

  //   return changed;
  // }

  updateTransform(newTransform: string) {
    console.log('whats happening', newTransform);
    this.setState({ transform: newTransform });
  }

  render() {
    return (
      <div>
        <h1 ref={this.moveableRef} style={{ transform: this.state.transform, position: 'absolute' }}>
          Move me
        </h1>
        <MoveableElement moveableRef={this.moveableRef} setStyle={this.updateTransform} />
      </div>
    );
  }
}
