import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { css } from 'emotion';
import { NavModel } from '@grafana/data';
import { Forms, stylesFactory } from '@grafana/ui';
import Page from '../../../core/components/Page/Page';
import { getNavModel } from '../../../core/selectors/navModel';
import { StoreState } from '../../../types';

interface Props {
  navModel: NavModel;
}

const importStyles = stylesFactory(() => {
  return {
    header: css`
      display: flex;
      justify-content: flex-end;
      margin-bottom: 32px;
    `,
  };
});

class DashboardImport extends PureComponent<Props> {
  render() {
    const { navModel } = this.props;
    const styles = importStyles();

    return (
      <Page navModel={navModel}>
        <Page.Contents>
          <div className={styles.header}>
            <Forms.Button>Upload .json file</Forms.Button>
          </div>
          <div>
            <Forms.Field label="Grafana.com Dashboard">
              <Forms.Input size="md" placeholder="Grafana.com dashboard url or id" />
            </Forms.Field>
          </div>
          <div>
            <Forms.Field label="Panel JSON">
              <Forms.TextArea rows={10} />
            </Forms.Field>
          </div>
          <div>
            <Forms.Button icon="fa fa-paste">Load</Forms.Button>
          </div>
        </Page.Contents>
      </Page>
    );
  }
}

const mapStateToProps = (state: StoreState) => {
  return {
    navModel: getNavModel(state.navIndex, 'import', null, true),
  };
};

export default connect(mapStateToProps)(DashboardImport);
