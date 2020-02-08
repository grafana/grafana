import React, { PureComponent } from 'react';
import { css, cx } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { stylesFactory, Forms } from '@grafana/ui';
import config from 'app/core/config';

import { PanelModel } from '../../state/PanelModel';
import { DashboardModel } from '../../state/DashboardModel';
import { DashboardPanel } from '../../dashgrid/DashboardPanel';
import { QueriesTab } from '../../panel_editor/QueriesTab';
import SplitPane from 'react-split-pane';
import { StoreState } from '../../../../types/store';
import { connect } from 'react-redux';
import { updateLocation } from '../../../../core/reducers/location';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const resizer = css`
    padding: 3px;
    font-style: italic;
    background: ${theme.colors.panelBg};
    &:hover {
      background: ${theme.colors.headingColor};
    }
  `;

  return {
    wrapper: css`
      width: 100%;
      height: 100%;
      position: fixed;
      z-index: ${theme.zIndex.modal};
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: ${theme.colors.pageBg};
    `,
    fill: css`
      width: 100%;
      height: 100%;
    `,
    resizerV: cx(
      resizer,
      css`
        cursor: col-resize;
      `
    ),
    resizerH: cx(
      resizer,
      css`
        cursor: row-resize;
      `
    ),
  };
});

interface Props {
  dashboard: DashboardModel;
  panel: PanelModel;
  updateLocation: typeof updateLocation;
}

interface State {
  dirtyPanel?: PanelModel;
}

export class PanelEditor extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    const { panel } = props;
    const dirtyPanel = panel.getEditClone();
    this.state = { dirtyPanel };
  }

  onPanelUpdate = () => {
    const { dirtyPanel } = this.state;
    const { dashboard } = this.props;
    dashboard.updatePanel(dirtyPanel);
  };

  onPanelExit = () => {
    const { updateLocation } = this.props;
    this.onPanelUpdate();
    updateLocation({
      query: { editPanel: null },
      partial: true,
    });
  };

  onDiscard = () => {
    this.props.updateLocation({
      query: { editPanel: null },
      partial: true,
    });
  };

  onDragFinished = () => {
    document.body.style.cursor = 'auto';
    console.log('TODO, save splitter settings');
  };

  render() {
    const { dashboard } = this.props;
    const { dirtyPanel } = this.state;

    const styles = getStyles(config.theme);

    if (!dirtyPanel) {
      return null;
    }

    return (
      <div className={styles.wrapper}>
        <div>
          <Forms.Button onClick={this.onPanelExit}>Exit</Forms.Button>
          {this.props.panel.title}
          <Forms.Button variant="destructive" onClick={this.onDiscard}>
            Discard
          </Forms.Button>
        </div>
        <SplitPane
          split="vertical"
          minSize={50}
          defaultSize={'80%'}
          resizerClassName={styles.resizerV}
          onDragStarted={() => (document.body.style.cursor = 'col-resize')}
          onDragFinished={this.onDragFinished}
        >
          <SplitPane
            split="horizontal"
            minSize={50}
            defaultSize={'60%'}
            resizerClassName={styles.resizerH}
            onDragStarted={() => (document.body.style.cursor = 'row-resize')}
            onDragFinished={this.onDragFinished}
          >
            <div className={styles.fill}>
              <DashboardPanel
                dashboard={dashboard}
                panel={dirtyPanel}
                isEditing={false}
                isInEditMode
                isFullscreen={false}
                isInView={true}
              />
            </div>
            <div>
              <QueriesTab panel={dirtyPanel} dashboard={dashboard} />
            </div>
          </SplitPane>
          <div>
            <div>TODO: viz settings</div>
          </div>
        </SplitPane>
      </div>
    );
  }
}

const mapStateToProps = (state: StoreState) => ({
  location: state.location,
});

const mapDispatchToProps = {
  updateLocation,
};

export default connect(mapStateToProps, mapDispatchToProps)(PanelEditor);
