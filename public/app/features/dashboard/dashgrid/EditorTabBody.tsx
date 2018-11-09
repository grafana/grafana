import React, { PureComponent } from 'react';
import CustomScrollbar from 'app/core/components/CustomScrollbar/CustomScrollbar';
import { FadeIn } from 'app/core/components/Animations/FadeIn';

interface Props {
  children: JSX.Element;
  main: EditorToolBarView;
  toolbarItems: EditorToolBarView[];
}

export interface EditorToolBarView {
  title: string;
  imgSrc?: string;
  icon?: string;
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
  };

  onCloseOpenView = () => {
    this.setState({ openView: null });
  };

  renderMainSelection(view: EditorToolBarView) {
    return (
      <div className="edit-section__selected" onClick={() => this.onToggleToolBarView(view)} key={view.title}>
        <img className="edit-section__selected-image" src={view.imgSrc} />
        <div className="edit-section__selected-name">{view.title}</div>
        <i className="fa fa-caret-down" />
      </div>
    );
  }

  renderButton(view: EditorToolBarView) {
    return (
      <div className="nav-buttons" key={view.title}>
        <button className="btn navbar-button">
          <i className={view.icon} /> {view.title}
        </button>
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
    const { children, toolbarItems, main } = this.props;
    const { openView } = this.state;

    return (
      <>
        <div className="edit-section">
          <div className="edit-section__header">
            {this.renderMainSelection(main)}
            <div className="gf-form--grow" />
            {toolbarItems.map(item => this.renderButton(item))}
          </div>
        </div>
        <div className="panel-editor__scroll">
          <CustomScrollbar>
            <div className="panel-editor__content">
              <FadeIn in={openView !== null} duration={200}>
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
