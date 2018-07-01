import React, { Component, ComponentClass } from 'react';

export interface OuterProps {
  type: string;
  queries: any[];
  isVisible: boolean;
}

export interface AddedProps {
  data: any[];
}

interface State {
  isLoading: boolean;
  data: any[];
}

const DataPanel = (ComposedComponent: ComponentClass<AddedProps & OuterProps>) => {
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
      this.issueQueries();
    }

    public issueQueries = () => {
      const { queries, isVisible } = this.props;

      if (!isVisible) {
        return;
      }

      if (!queries.length) {
        this.setState({ data: [{ message: 'no queries' }] });
        return;
      }

      this.setState({ isLoading: true });
    };

    public render() {
      const { data, isLoading } = this.state;

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

export default DataPanel;
