import React, { Component, ComponentClass } from 'react';

export interface OuterProps {
  type: string;
  queries: any[];
  isVisible: boolean;
}

export interface PanelProps extends OuterProps {
  data: any[];
}

export interface DataPanel extends ComponentClass<OuterProps> {
}

interface State {
  isLoading: boolean;
  data: any[];
}

export const DataPanelWrapper = (ComposedComponent: ComponentClass<PanelProps>) => {
  class Wrapper extends Component<OuterProps, State> {
    public static defaultProps = {
      isVisible: true,
    };

    constructor(props: OuterProps) {
      super(props);

      this.state = {
        isLoading: false,
        data: [],
      };
    }

    public componentDidMount() {
      console.log('data panel mount');
      this.issueQueries();
    }

    public issueQueries = async () => {
      const { isVisible } = this.props;

      if (!isVisible) {
        return;
      }

      this.setState({ isLoading: true });

      await new Promise(resolve => {
        setTimeout(() => {

          this.setState({ isLoading: false, data: [{value: 10}] });

        }, 500);
      });
    };

    public render() {
      const { data, isLoading } = this.state;
      console.log('data panel render');

      if (!data.length) {
        return (
          <div className="no-data">
            <p>No Data</p>
          </div>
        );
      }

      if (isLoading) {
        return (
          <div className="loading">
            <p>Loading</p>
          </div>
        );
      }

      return <ComposedComponent {...this.props} data={data} />;
    }
  }

  return Wrapper;
};

