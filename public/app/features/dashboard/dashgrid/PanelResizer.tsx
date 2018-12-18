import React, { PureComponent } from 'react';
import { ResizableBox } from 'react-resizable';
import { PanelModel } from '../panel_model';
import { debounce } from 'lodash';

interface DimensionsXY {
  x: number;
  y: number;
}

export interface Props {
  isEditing: boolean;
  panel: PanelModel;
}

export interface State {
  panelDimensions: DimensionsXY;
  hasEventListener: boolean;
}

export class PanelResizer extends PureComponent<Props, State> {
  element: HTMLElement;
  debouncedResizeDone: () => void;
  debouncedUpdatePanelDimensions: () => void;

  constructor(props) {
    super(props);
    const { panel } = this.props;
    const debounceTimeMs = 100;
    this.debouncedResizeDone = debounce(() => {
      panel.resizeDone();
    }, debounceTimeMs);

    this.debouncedUpdatePanelDimensions = debounce(this.updatePanelDimensions, debounceTimeMs);

    this.state = {
      panelDimensions: this.panelDimensions,
      hasEventListener: false,
    };
  }

  componentDidMount() {
    this.handleResizeEventListener();
  }

  componentDidUpdate() {
    this.handleResizeEventListener();
  }

  componentWillUnmount() {
    this.removeEventListener();
  }

  handleResizeEventListener = () => {
    const { isEditing } = this.props;
    const { hasEventListener } = this.state;
    if (isEditing && !hasEventListener) {
      this.addEventListener();
    } else if (!isEditing && hasEventListener) {
      this.removeEventListener(true);
    }
  };

  addEventListener = () => {
    window.addEventListener('resize', this.debouncedUpdatePanelDimensions);
    this.setState({ hasEventListener: true });
  };

  removeEventListener = (skipStateChange = false) => {
    window.removeEventListener('resize', this.debouncedUpdatePanelDimensions);
    if (!skipStateChange) {
      this.setState({ hasEventListener: false });
    }
  };

  get panelDimensions(): DimensionsXY {
    return {
      x: document.documentElement.scrollWidth,
      y: Math.floor(document.documentElement.scrollHeight * 0.4),
    };
  }

  updatePanelDimensions = () => {
    this.setState({
      panelDimensions: this.panelDimensions,
    });
  };

  render() {
    const { children, isEditing } = this.props;
    const { x, y } = this.state.panelDimensions;
    return isEditing ? (
      <ResizableBox height={y} width={x} axis="y" onResize={this.debouncedResizeDone}>
        <>{children}</>
      </ResizableBox>
    ) : (
      <>{children}</>
    );
  }
}
