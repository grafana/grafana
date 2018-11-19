import React, { PureComponent } from 'react';
import CustomScrollbar from 'app/core/components/CustomScrollbar/CustomScrollbar';
import { FadeIn } from 'app/core/components/Animations/FadeIn';

interface Props {
  children: JSX.Element;
  main?: EditorToolBarView;
  toolbarItems: EditorToolBarView[];
}

export interface EditorToolBarView {
  title: string;
  imgSrc?: string;
  icon?: string;
  render: (closeFunction: any) => JSX.Element;
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
      <div className="toolbar__main" onClick={() => this.onToggleToolBarView(view)} key={view.title}>
        <img className="toolbar__main-image" src={view.imgSrc} />
        <div className="toolbar__main-name">{view.title}</div>
        <i className="fa fa-caret-down" />
      </div>
    );
  }

  renderButton(view: EditorToolBarView) {
    return (
      <div className="nav-buttons" key={view.title}>
        <button className="btn navbar-button" onClick={() => this.onToggleToolBarView(view)}>
          {view.icon && <i className={view.icon} />} {view.title}
        </button>
      </div>
    );
  }

  renderOpenView(view: EditorToolBarView) {
    return (
      <div className="toolbar-subview">
        <button className="toolbar-subview__close" onClick={this.onCloseOpenView}>
          <i className="fa fa-chevron-up" />
        </button>
        {view.render(this.onCloseOpenView)}
      </div>
    );
  }

  render() {
    const { children, toolbarItems, main } = this.props;
    const { openView } = this.state;
    return (
      <>
        {main && (
          <div className="toolbar">
            {this.renderMainSelection(main)}
            <div className="gf-form--grow" />
            {toolbarItems.map(item => this.renderButton(item))}
          </div>
        )}
        <div className="panel-editor__scroll">
          <CustomScrollbar autoHide={false}>
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
