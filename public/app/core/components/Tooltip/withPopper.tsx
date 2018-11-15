import React from 'react';

export interface UsingPopperProps {
  showPopper: (prevState: object) => void;
  hidePopper: (prevState: object) => void;
  renderContent: (content: any) => any;
  show: boolean;
  placement?: string;
  content: string | ((props: any) => JSX.Element);
  className?: string;
  refClassName?: string;
}

interface Props {
  placement?: string;
  className?: string;
  refClassName?: string;
  content: string | ((props: any) => JSX.Element);
}

interface State {
  placement: string;
  show: boolean;
}

export default function withPopper(WrappedComponent) {
  return class extends React.Component<Props, State> {
    constructor(props) {
      super(props);
      this.setState = this.setState.bind(this);
      this.state = {
        placement: this.props.placement || 'auto',
        show: false,
      };
    }

    componentWillReceiveProps(nextProps) {
      if (nextProps.placement && nextProps.placement !== this.state.placement) {
        this.setState(prevState => {
          return {
            ...prevState,
            placement: nextProps.placement,
          };
        });
      }
    }

    showPopper = () => {
      this.setState(prevState => ({
        ...prevState,
        show: true,
      }));
    };

    hidePopper = () => {
      this.setState(prevState => ({
        ...prevState,
        show: false,
      }));
    };

    renderContent(content) {
      if (typeof content === 'function') {
        // If it's a function we assume it's a React component
        const ReactComponent = content;
        return <ReactComponent />;
      }
      return content;
    }

    render() {
      const { show, placement } = this.state;
      const className = this.props.className || '';

      return (
        <WrappedComponent
          {...this.props}
          showPopper={this.showPopper}
          hidePopper={this.hidePopper}
          renderContent={this.renderContent}
          show={show}
          placement={placement}
          className={className}
        />
      );
    }
  };
}
