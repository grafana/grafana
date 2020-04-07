// Libraries
import React, { PureComponent } from 'react';

// Components
import { CustomScrollbar, PanelOptionsGroup } from '@grafana/ui';
import { FadeIn } from 'app/core/components/Animations/FadeIn';

interface Props {
  children: JSX.Element;
  heading: string;
  renderToolbar?: () => JSX.Element;
  toolbarItems?: EditorToolbarView[];
  scrollTop?: number;
  setScrollTop?: (value: React.MouseEvent<HTMLElement>) => void;
}

export interface EditorToolbarView {
  title?: string;
  heading?: string;
  icon?: string;
  disabled?: boolean;
  onClick?: () => void;
  render?: () => JSX.Element;
  action?: () => void;
  btnType?: 'danger';
}

interface State {
  openView?: EditorToolbarView;
  isOpen: boolean;
  fadeIn: boolean;
}

export class EditorTabBody extends PureComponent<Props, State> {
  static defaultProps: Partial<Props> = {
    toolbarItems: [],
  };

  constructor(props: Props) {
    super(props);

    this.state = {
      openView: null,
      fadeIn: false,
      isOpen: false,
    };
  }

  componentDidMount() {
    this.setState({ fadeIn: true });
  }

  onToggleToolBarView = (item: EditorToolbarView) => {
    this.setState({
      openView: item,
      isOpen: this.state.openView !== item || !this.state.isOpen,
    });
  };

  onCloseOpenView = () => {
    this.setState({ isOpen: false });
  };

  static getDerivedStateFromProps(props: Props, state: State) {
    if (state.openView) {
      const activeToolbarItem = props.toolbarItems.find(
        (item: any) => item.title === state.openView.title && item.icon === state.openView.icon
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

  renderButton(view: EditorToolbarView) {
    const onClick = () => {
      if (view.onClick) {
        view.onClick();
      }

      if (view.render) {
        this.onToggleToolBarView(view);
      }
    };

    return (
      <div className="nav-buttons" key={view.title + view.icon}>
        <button className="btn navbar-button" onClick={onClick} disabled={view.disabled}>
          {view.icon && <i className={view.icon} />} {view.title}
        </button>
      </div>
    );
  }

  renderOpenView(view: EditorToolbarView) {
    return (
      <PanelOptionsGroup title={view.title || view.heading} onClose={this.onCloseOpenView}>
        {view.render()}
      </PanelOptionsGroup>
    );
  }

  render() {
    const { children, renderToolbar, heading, toolbarItems, scrollTop, setScrollTop } = this.props;
    const { openView, fadeIn, isOpen } = this.state;

    return (
      <>
        <div className="toolbar">
          <div className="toolbar__left">
            <div className="toolbar__heading">{heading}</div>
            {renderToolbar && renderToolbar()}
          </div>
          {toolbarItems.map(item => this.renderButton(item))}
        </div>
        <div className="panel-editor__scroll">
          <CustomScrollbar autoHide={false} scrollTop={scrollTop} setScrollTop={setScrollTop} updateAfterMountMs={300}>
            <div className="panel-editor__content">
              <FadeIn in={isOpen} duration={200} unmountOnExit={true}>
                {openView && this.renderOpenView(openView)}
              </FadeIn>
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
