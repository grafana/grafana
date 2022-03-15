import React from 'react';
import clsx from 'clsx';
import { Maybe } from 'true-myth';
import Graph from './FlameGraphComponent';
import { createFF } from './flamebearer';
import { DefaultPalette } from './FlameGraphComponent/colorPalette';

export class FlameGraphRenderer extends React.Component<any, any, any> {
  initialFlamegraphState = {
    focusedNode: Maybe.nothing(),
    zoom: Maybe.nothing(),
  };

  display: any;
  currentJSONController: any;

  constructor(props: any) {
    super(props);
    this.state = {
      isFlamegraphDirty: false,
      sortBy: 'self',
      sortByDirection: 'desc',
      view: 'both',
      viewDiff: props.viewType === 'diff' ? 'diff' : undefined,
      fitMode: props.fitMode ? props.fitMode : 'HEAD',
      flamebearer: props.flamebearer,

      // query used in the 'search' checkbox
      highlightQuery: '',

      flamegraphConfigs: this.initialFlamegraphState,

      // TODO make this come from the redux store?
      palette: DefaultPalette,
    };

    // for situations like in grafana we only display the flamegraph
    // 'both' | 'flamegraph' | 'table'
    this.display = props.display !== undefined ? props.display : 'both';
  }

  componentDidUpdate(prevProps: any, prevState: any) {
    const previousFlamebearer = prevProps.flamebearer;
    const actualFlamebearer = this.props.flamebearer;
    if (previousFlamebearer !== actualFlamebearer) {
      this.updateFlamebearerData();
    }

    // flamegraph configs changed
    if (prevState.flamegraphConfigs !== this.state.flamegraphConfigs) {
      this.updateFlamegraphDirtiness();
    }
  }

  componentWillUnmount() {
    this.abortCurrentJSONController();
  }

  handleSearchChange = (e: any) => {
    this.setState({
      highlightQuery: e,
    });
  };

  onReset = () => {
    this.setState({
      ...this.state,
      flamegraphConfigs: {
        ...this.state.flamegraphConfigs,
        ...this.initialFlamegraphState,
      },
    });
  };

  onFlamegraphZoom = (bar: any) => {
    // zooming on the topmost bar is equivalent to resetting to the original state
    if (bar.isJust && bar.value.i === 0 && bar.value.j === 0) {
      this.onReset();
      return;
    }

    // otherwise just pass it up to the state
    // doesn't matter if it's some or none
    this.setState({
      ...this.state,
      flamegraphConfigs: {
        ...this.state.flamegraphConfigs,
        zoom: bar,
      },
    });
  };

  onFocusOnNode = (i: number, j: number) => {
    if (i === 0 && j === 0) {
      this.onReset();
      return;
    }

    let flamegraphConfigs = { ...this.state.flamegraphConfigs };

    // reset zoom if we are focusing below the zoom
    // or the same one we were zoomed
    const { zoom } = this.state.flamegraphConfigs;
    if (zoom.isJust) {
      if (zoom.value.i <= i) {
        flamegraphConfigs = {
          ...flamegraphConfigs,
          zoom: this.initialFlamegraphState.zoom,
        };
      }
    }

    this.setState({
      ...this.state,
      flamegraphConfigs: {
        ...flamegraphConfigs,
        focusedNode: Maybe.just({ i, j }),
      },
    });
  };

  updateFlamegraphDirtiness = () => {
    const isDirty = this.isDirty();

    this.setState({
      isFlamegraphDirty: isDirty,
    });
  };

  isDirty = () => {
    // TODO: is this a good idea?
    return JSON.stringify(this.initialFlamegraphState) !== JSON.stringify(this.state.flamegraphConfigs);
  };

  updateFlamebearerData() {
    this.setState({
      flamebearer: this.props.flamebearer,
    });
  }

  parseFormat(format: any) {
    return createFF(format || this.state.format);
  }

  abortCurrentJSONController() {
    if (this.currentJSONController) {
      this.currentJSONController.abort();
    }
  }

  render = () => {
    const dataExists =
      this.state.view !== 'table' || (this.state.flamebearer && this.state.flamebearer.names.length <= 1);

    const flamegraphDataTestId = figureFlamegraphDataTestId(this.props.viewType, this.props.viewSide);

    const flameGraphPane =
      this.state.flamebearer && dataExists ? (
        <Graph
          key="flamegraph-pane"
          data-testid={flamegraphDataTestId}
          flamebearer={this.state.flamebearer}
          //@ts-ignore
          format={this.parseFormat(this.state.flamebearer.format)}
          view={this.state.view}
          ExportData={() => this.props.ExportData || <></>}
          highlightQuery={this.state.highlightQuery}
          fitMode={this.state.fitMode}
          viewType={this.props.viewType}
          zoom={this.state.flamegraphConfigs.zoom}
          focusedNode={this.state.flamegraphConfigs.focusedNode}
          label={this.props.query}
          onZoom={this.onFlamegraphZoom}
          onFocusOnNode={this.onFocusOnNode}
          onReset={this.onReset}
          isDirty={this.isDirty}
          palette={this.state.palette}
          setPalette={(p) =>
            this.setState({
              palette: p,
            })
          }
        />
      ) : null;

    const panes = decidePanesOrder(this.props.viewType, this.display, flameGraphPane);

    return (
      <div
        className={clsx('canvas-renderer', {
          double: this.props.viewType === 'double',
        })}
      >
        <div className="canvas-container">
          {this.props.children}
          <div
            style={{ width: '100%' }}
            className={`${clsx('flamegraph-container panes-wrapper', {
              'vertical-orientation': this.props.viewType === 'double',
            })}`}
          >
            {panes.map((pane) => pane)}
          </div>
        </div>
      </div>
    );
  };
}

function decidePanesOrder(viewType: any, display: any, flamegraphPane: any) {
  switch (display) {
    case 'flamegraph': {
      return [flamegraphPane];
    }

    case 'both':
    default: {
      switch (viewType) {
        case 'double':
          return [flamegraphPane];
        default:
          return [flamegraphPane];
      }
    }
  }
}

function figureFlamegraphDataTestId(viewType: any, viewSide: any) {
  switch (viewType) {
    case 'single': {
      return `flamegraph-single`;
    }
    case 'double': {
      return `flamegraph-comparison-${viewSide}`;
    }
    case 'diff': {
      return `flamegraph-diff`;
    }

    default:
      throw new Error(`Unsupported viewType: ${viewType}`);
  }
}
