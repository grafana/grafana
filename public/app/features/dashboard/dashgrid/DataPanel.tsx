// Library
import React, { Component } from 'react';

interface RenderProps {
  loading: LoadingState;
  data: any;
}

export interface Props {
  datasource: string | null;
  queries: any[];
  children: (r: RenderProps) => JSX.Element;
}

export interface State {
  isFirstLoad: boolean;
  loading: LoadingState;
  data: any;
}

export enum LoadingState {
  NotStarted = 'NotStarted',
  Loading = 'Loading',
  Done = 'Done',
  Error = 'Error',
}

export interface PanelProps extends RenderProps {}

export class DataPanel extends Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      loading: LoadingState.NotStarted,
      data: [],
      isFirstLoad: true,
    };
  }

  componentDidMount() {
    console.log('DataPanel mount');
    this.issueQueries();
  }

  issueQueries = async () => {
    this.setState({ loading: LoadingState.Loading });

    await new Promise(resolve => {
      setTimeout(() => {
        this.setState({ loading: LoadingState.Done, data: [{ value: 10 }], isFirstLoad: false });
      }, 500);
    });
  };

  render() {
    const { data, loading, isFirstLoad } = this.state;
    console.log('data panel render');

    if (isFirstLoad && loading === LoadingState.Loading) {
      return (
        <div className="loading">
          <p>Loading</p>
        </div>
      );
    }

    return (
      <>
        {this.loadingSpinner}
        {this.props.children({
          data,
          loading,
        })}
      </>
    );
  }

  private get loadingSpinner(): JSX.Element {
    const { loading } = this.state;

    if (loading === LoadingState.Loading) {
      return (
        <div className="panel__loading">
          <i className="fa fa-spinner fa-spin" />
        </div>
      );
    }

    return null;
  }
}
