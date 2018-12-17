import React, { PureComponent } from 'react';
import Remarkable from 'remarkable';
import { getBackendSrv } from '../../services/backend_srv';
import { DataSource } from 'app/types';

interface Props {
  dataSource: DataSource;
  type: string;
}

interface State {
  isError: boolean;
  isLoading: boolean;
  help: any;
}

export default class PanelHelp extends PureComponent<Props, State> {
  componentDidMount(): void {
    this.loadHelp();
  }

  loadHelp = () => {
    const { dataSource, type } = this.props;
    this.setState({ isLoading: true });

    getBackendSrv()
      .get(`/api/plugins/${dataSource.meta.id}/markdown/${type}`)
      .then(response => {
        const markdown = new Remarkable();
        const helpHtml = markdown.render(response);

        this.setState({
          isError: false,
          isLoading: false,
          help: helpHtml,
        });
      })
      .catch(() => {
        this.setState({
          isError: true,
          isLoading: false,
        });
      });
  };

  render() {
    const { isError, isLoading, help } = this.state;

    if (isLoading) {
      return <h2>Loading help...</h2>;
    }

    if (isError) {
      return <h3>'Error occurred when loading help'</h3>;
    }

    return <div className="markdown-html" dangerouslySetInnerHTML={{ __html: help }} />;
  }
}
