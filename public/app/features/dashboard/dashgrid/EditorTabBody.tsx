import React, { PureComponent } from 'react';
import CustomScrollbar from 'app/core/components/CustomScrollbar/CustomScrollbar';
import { FadeIn } from 'app/core/components/Animations/FadeIn';

interface Props {
  children: JSX.Element;
  heading: string;
  main?: EditorToolBarView;
  toolbarItems: EditorToolBarView[];
}

export interface EditorToolBarView {
  title: string;
  imgSrc?: string;
  icon?: string;
  disabled?: boolean;
  onClick?: () => void;
  render: (closeFunction: any) => JSX.Element | JSX.Element[];
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

  static getDerivedStateFromProps(props, state) {
    if (state.openView) {
      const activeToolbarItem = props.toolbarItems.find(
        item => item.title === state.openView.title && item.icon === state.openView.icon
      );
      if (activeToolbarItem) {
        return {
          ...state,
          openView: activeToolbarItem,
        };
      }
    }
    return state;
  }

  renderMainSelection(view: EditorToolBarView) {
    return (
      <div className="toolbar__main" onClick={() => this.onToggleToolBarView(view)} key={view.title + view.icon}>
        <img className="toolbar__main-image" src={view.imgSrc} />
        <div className="toolbar__main-name">{view.title}</div>
        <i className="fa fa-caret-down" />
      </div>
    );
  }

  renderButton(view: EditorToolBarView) {
    const onClick = () => {
      if (view.onClick) {
        view.onClick();
      }
      this.onToggleToolBarView(view);
    };

    return (
      <div className="nav-buttons" key={view.title + view.icon}>
        <button className="btn navbar-button" onClick={onClick} disabled={view.disabled}>
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
    const { children, toolbarItems, main, heading } = this.props;
    const { openView } = this.state;
    return (
      <>
        <div className="toolbar">
          <div className="toolbar__heading">{heading}</div>
          {main && this.renderMainSelection(main)}
          <div className="gf-form--grow" />
          {toolbarItems.map(item => this.renderButton(item))}
        </div>
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
