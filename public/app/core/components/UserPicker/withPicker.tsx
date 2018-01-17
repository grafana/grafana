import React, { Component } from 'react';

export interface IProps {
  backendSrv: any;
  handlePicked: (data) => void;
}

// export interface User {
//     id: number;
//     name: string;
//     login: string;
//     email: string;
// }

export default function withPicker(WrappedComponent) {
  return class WithPicker extends Component<IProps, any> {
    constructor(props) {
      super(props);
      this.toggleLoading = this.toggleLoading.bind(this);

      this.state = {
        multi: false,
        isLoading: false,
      };
    }

    toggleLoading(isLoading) {
      this.setState(prevState => {
        return {
          ...prevState,
          isLoading: isLoading,
        };
      });
    }

    render() {
      return <WrappedComponent toggleLoading={this.toggleLoading} isLoading={this.state.isLoading} {...this.props} />;
    }
  };
}
