import React, { PureComponent } from 'react';
import { debounce, throttle } from 'lodash';
import Draggable from 'react-draggable';

import { PanelModel } from '../panel_model';

interface Props {
  isEditing: boolean;
  render: (height: number | 'inherit') => JSX.Element;
  panel: PanelModel;
}

interface State {
  editorHeight: number;
}

export class PanelResizer extends PureComponent<Props, State> {
  initialHeight: number = Math.floor(document.documentElement.scrollHeight * 0.4);
  prevEditorHeight: number;
  debouncedChangeHeight: (height: number) => void;
  debouncedResizeDone: () => void;

  constructor(props) {
    super(props);
    const { panel } = this.props;

    this.state = {
      editorHeight: this.initialHeight,
    };

    this.debouncedChangeHeight = throttle(this.changeHeight, 20, { trailing: true });
    this.debouncedResizeDone = debounce(() => {
      panel.resizeDone();
    }, 200);
  }

  changeHeight = height => {
    this.prevEditorHeight = this.state.editorHeight;
    this.setState({
      editorHeight: height,
    });
  };

  onDrag = (evt, data) => {
    const newHeight = this.state.editorHeight + data.y;
    this.debouncedChangeHeight(newHeight);
    this.debouncedResizeDone();
  };

  render() {
    const { render, isEditing } = this.props;
    const { editorHeight } = this.state;

    return (
      <>
        {render(isEditing ? editorHeight : 'inherit')}
        {isEditing && (
          <div className="panel-editor-container__resizer">
            <Draggable axis="y" grid={[100, 1]} onDrag={this.onDrag} position={{ x: 0, y: 0 }}>
              <div className="panel-editor-resizer">
                <div className="panel-editor-resizer__handle" />
              </div>
            </Draggable>
          </div>
        )}
      </>
    );
  }
}
