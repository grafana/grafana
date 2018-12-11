import React, { PureComponent } from 'react';
import CustomScrollbar from 'app/core/components/CustomScrollbar/CustomScrollbar';
import { FadeIn } from 'app/core/components/Animations/FadeIn';

interface Props {
  children: JSX.Element;
  heading: string;
  renderToolbar: () => JSX.Element;
}

interface State {
  fadeIn: boolean;
}

export class EditorTabBody extends PureComponent<Props, State> {
  constructor(props) {
    super(props);

    this.state = {
      fadeIn: false,
    };
  }

  componentDidMount() {
    this.setState({ fadeIn: true });
  }

  // renderMainSelection(view: EditorToolBarView) {
  //   return (
  //     <div className="toolbar__main" onClick={() => this.onToggleToolBarView(view)} key={view.title + view.icon}>
  //       <img className="toolbar__main-image" src={view.imgSrc} />
  //       <div className="toolbar__main-name">{view.title}</div>
  //       <i className="fa fa-caret-down" />
  //     </div>
  //   );
  // }
  //
  // renderButton(view: EditorToolBarView) {
  //   const onClick = () => {
  //     if (view.onClick) {
  //       view.onClick();
  //     }
  //     this.onToggleToolBarView(view);
  //   };
  //
  //   return (
  //     <div className="nav-buttons" key={view.title + view.icon}>
  //       <button className="btn navbar-button" onClick={onClick} disabled={view.disabled}>
  //         {view.icon && <i className={view.icon} />} {view.title}
  //       </button>
  //     </div>
  //   );
  // }
  //
  // renderOpenView(view: EditorToolBarView) {
  //   return (
  //     <div className="toolbar-subview">
  //       <button className="toolbar-subview__close" onClick={this.onCloseOpenView}>
  //         <i className="fa fa-chevron-up" />
  //       </button>
  //       {view.render(this.onCloseOpenView)}
  //     </div>
  //   );
  // }

  render() {
    const { children, renderToolbar, heading } = this.props;
    const { fadeIn } = this.state;

    return (
      <>
        <div className="toolbar">
          <div className="toolbar__heading">{heading}</div>
          {renderToolbar && renderToolbar()}
        </div>
        <div className="panel-editor__scroll">
          <CustomScrollbar autoHide={false}>
            <div className="panel-editor__content">
              <FadeIn in={fadeIn} duration={50}>
                {children}
              </FadeIn>
            </div>
          </CustomScrollbar>
        </div>
      </>
    );
  }
}
