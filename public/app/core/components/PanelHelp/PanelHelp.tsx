import React, { PureComponent } from 'react';
import Remarkable from 'remarkable';
import { getBackendSrv } from '../../services/backend_srv';
import { PluginMeta } from 'app/types';

interface Props {
  plugin: PluginMeta;
  type: string;
}

interface State {
  isError: boolean;
  isLoading: boolean;
  help: string;
}

export default class PanelHelp extends PureComponent<Props, State> {
  state = {
    isError: false,
    isLoading: false,
    help: '',
  };

  componentDidMount(): void {
    this.loadHelp();
  }

  constructPlaceholderInfo() {
    const { plugin } = this.props;
    const markdown = new Remarkable();

    return markdown.render(
      `## ${plugin.name} \n by _${plugin.info.author.name} (<${plugin.info.author.url}>)_\n\n${
        plugin.info.description
      }\n\n### Links \n ${plugin.info.links.map(link => {
        return `${link.name}: <${link.url}>\n`;
      })}`
    );
  }

  loadHelp = () => {
    const { plugin, type } = this.props;
    this.setState({ isLoading: true });

    getBackendSrv()
      .get(`/api/plugins/${plugin.id}/markdown/${type}`)
      .then(response => {
        const markdown = new Remarkable();
        const helpHtml = markdown.render(response);

        if (response === '' && this.props.type) {
          this.setState({
            isError: false,
            isLoading: false,
            help: this.constructPlaceholderInfo(),
          });
        } else {
          this.setState({
            isError: false,
            isLoading: false,
            help: helpHtml,
          });
        }
      })
      .catch(() => {
        this.setState({
          isError: true,
          isLoading: false,
        });
      });
  };

  render() {
    const { type } = this.props;
    const { isError, isLoading, help } = this.state;

    if (isLoading) {
      return <h2>Loading help...</h2>;
    }

    if (isError) {
      return <h3>'Error occurred when loading help'</h3>;
    }

    if (type === 'panel_help' && help === '') {
    }

    return <div className="markdown-html" dangerouslySetInnerHTML={{ __html: help }} />;
  }
}
