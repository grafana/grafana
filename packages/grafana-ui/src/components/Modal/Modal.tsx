import React, { Suspense } from 'react';
import { Portal } from '../Portal/Portal';
import { css, cx } from 'emotion';

const modalBackdrop = css`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1040;
  background-color: #f7f8fa;
  opacity: 0.8;
  backdrop-filter: blur(4px);
`;

interface Props {
  title: string;
  tabs: Array<{
    title: string;
    content: string | JSX.Element;
  }>;

  icon?: string;
  onDismiss?: () => void;
}

interface State {
  selectedIndex: number;
}

export class Modal extends React.PureComponent<Props, State> {
  state = {
    selectedIndex: 0,
  };

  selectTab = (tabIndex: number) => {
    this.setState({
      selectedIndex: tabIndex,
    });
  };

  handleDismiss = () => {
    if (this.props.onDismiss) {
      this.props.onDismiss();
    }
  };

  render() {
    const { title, icon, tabs } = this.props;
    const { selectedIndex } = this.state;

    return (
      <Portal>
        <div className="modal">
          <div className="modal-header">
            <h2 className="modal-header-title">
              {icon && <i className={`fa ${icon}`} />}
              <span className="p-l-1">{title}</span>
            </h2>

            <ul className="gf-tabs">
              {tabs.map((tab, index) => (
                <li className="gf-tabs-item" key={index}>
                  <a
                    className={`gf-tabs-link${selectedIndex === index ? ' active' : ''}`}
                    onClick={() => this.selectTab(index)}
                  >
                    {tab.title}
                  </a>
                </li>
              ))}
            </ul>

            <a className="modal-header-close" onClick={this.handleDismiss}>
              <i className="fa fa-remove" />
            </a>
          </div>
          <div className="modal-content">
            <Suspense fallback={<div>Loading...</div>}>{tabs[selectedIndex].content}</Suspense>
          </div>
        </div>
        <div className={cx(modalBackdrop)} />
      </Portal>
    );
  }
}
