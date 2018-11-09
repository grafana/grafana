import React, { PureComponent } from 'react';
import CustomScrollbar from 'app/core/components/CustomScrollbar/CustomScrollbar';
import { FadeIn } from 'app/core/components/Animations/FadeIn';

interface Props {
  selectedText?: string;
  selectedImage?: string;
  children: JSX.Element;
  toolbarItems: EditorToolBarView[];
}

export interface EditorToolBarView {
  title: string;
  imgSrc: string;
  render: () => JSX.Element;
}

interface State {
  openView?: EditorToolBarView;
}

export class EditorTabBody extends PureComponent<Props, State> {
  constructor(props) {
    super(props);

    this.state = {
      openView: null,
    };
  }

  onToggleToolBarView = (item: EditorToolBarView) => {
    this.setState({
      openView: item === this.state.openView ? null : item,
    });
  }

  onCloseOpenView = () => {
    this.setState({ openView: null });
  }

  renderToolBarViewToggle(item: EditorToolBarView) {
    return (
      <div className="edit-section__selected" onClick={() => this.onToggleToolBarView(item)} key={item.title}>
        <img className="edit-section__selected-image" src={item.imgSrc} />
        <div className="edit-section__selected-name">{item.title}</div>
        <i className="fa fa-caret-down" />
      </div>
    );
  }

  renderOpenView(view: EditorToolBarView) {
    return (
      <div className="editor-toolbar-view">
        <button className="editor-toolbar-view__close" onClick={this.onCloseOpenView}>
          <i className="fa fa-remove" />
        </button>
        {view.render()}
      </div>
    );
  }

  render() {
    const { children, toolbarItems} = this.props;
    const { openView } = this.state;

    return (
      <>
      <div className="edit-section">
        <div className="edit-section__header">{toolbarItems.map(item => this.renderToolBarViewToggle(item))}</div>
      </div>
      <div className="panel-editor__scroll">
        <CustomScrollbar>
          <div className="panel-editor__content">
            <FadeIn in={openView !== null} duration={300}>
              {openView && this.renderOpenView(openView)}
            </FadeIn>
            {children}
          </div>
        </CustomScrollbar>
      </div>
      </>
      );
  }
}
