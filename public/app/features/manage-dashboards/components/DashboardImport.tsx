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
    option: css`
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
          <div className={styles.option}>
            <h3>Import via .json file</h3>
            <Forms.Button>Upload .json file</Forms.Button>
          </div>
          <div className={styles.option}>
            <h3>Import via grafana.com</h3>
            <Forms.Field>
              <Forms.Input
                size="md"
                placeholder="Grafana.com dashboard url or id"
                addonAfter={<Forms.Button>Load</Forms.Button>}
              />
            </Forms.Field>
          </div>
          <div className={styles.option}>
            <h3>Import via panel json</h3>
            <Forms.Field>
              <Forms.TextArea rows={10} />
            </Forms.Field>
            <Forms.Button>Load</Forms.Button>
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
