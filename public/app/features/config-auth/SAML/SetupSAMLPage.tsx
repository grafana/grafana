import { css } from '@emotion/css';
import React, { useEffect } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { StoreState } from 'app/types';

import { loadSettings } from '../state/actions';
import { selectSamlConfig } from '../state/selectors';
import { getEnabledAuthProviders } from '../utils';

import { SAMLStepGeneral } from './SAMLStepGeneral';
import { SAMLStepSelector } from './SAMLStepSelector';

interface OwnProps {}

export type Props = OwnProps & ConnectedProps<typeof connector>;

function mapStateToProps(state: StoreState) {
  return {
    settings: state.authConfig.settings,
    samlSettings: selectSamlConfig(state.authConfig),
    step: state.authConfig.samlStep,
  };
}

const mapDispatchToProps = {
  loadSettings,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export const SetupSAMLPageUnconnected = ({ settings, samlSettings, step, loadSettings }: Props): JSX.Element => {
  const styles = useStyles2(getStyles);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const enabledAuthProviders = getEnabledAuthProviders(settings);
  console.log(enabledAuthProviders);

  const pageNav: NavModelItem = {
    text: 'Setup SAML 2.0 Single Sign On',
    subTitle: `This configurator will guide you throug the process of configuration of SAML 2.0. You will need to follow
      steps and visit Identity Provider's applicatation to connect it with Grafana (Service Provider). You can
      track you progress.`,
    icon: 'shield',
    id: 'SAML',
    breadcrumbs: [{ title: 'Authentication', url: 'admin/authentication' }],
  };

  return (
    <Page navId="authentication" pageNav={pageNav}>
      <Page.Contents>
        <div>
          <SAMLStepSelector />
        </div>
        {step === 1 && <SAMLStepGeneral />}
      </Page.Contents>
    </Page>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    cardsContainer: css`
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(288px, 1fr));
      gap: ${theme.spacing(3)};
    `,
  };
};

const SetupSAMLPage = connector(SetupSAMLPageUnconnected);
export default SetupSAMLPage;
