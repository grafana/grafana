import React, { PureComponent } from 'react';
import { css } from 'emotion';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer';
import { PanelModel } from '../../state';

interface Props {
  source: PanelModel;
  panel: PanelModel;
}

interface State {
  source: string;
  panel: string;
}

export class PanelModelDiffView extends PureComponent<Props, State> {
  state = {
    source: '',
    panel: '',
  };

  componentDidMount() {
    this.componentDidUpdate({ source: null, panel: null });
  }

  componentDidUpdate(oldProps: Props) {
    const { source, panel } = this.props;
    if (source && source !== oldProps.source) {
      this.setState({
        source: JSON.stringify(source.getSaveModel(), null, 2),
      });
    }

    if (panel && panel !== oldProps.panel) {
      this.setState({
        panel: JSON.stringify(panel.getSaveModel(), null, 2),
      });
    }
  }

  render() {
    const { source, panel } = this.state;
    return (
      <div className={styles.wrapper}>
        <ReactDiffViewer oldValue={source} newValue={panel} compareMethod={DiffMethod.WORDS} splitView={true} />
      </div>
    );
  }
}

/*
 * Styles
 */
const styles = {
  wrapper: css`
    width: 100%;
    height: 100%;
    overflow: scroll;
  `,
  inner: css`
    border: 1px solid red;
  `,
};
