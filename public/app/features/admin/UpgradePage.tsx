import { css } from '@emotion/css';
import React from 'react';
import { connect } from 'react-redux';

import { GrafanaTheme2, NavModel } from '@grafana/data';
import { LinkButton, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { getNavModel } from '../../core/selectors/navModel';
import { StoreState } from '../../types';

import { LicenseChrome } from './LicenseChrome';
import { ServerStats } from './ServerStats';

interface Props {
  navModel: NavModel;
}

export function UpgradePage({ navModel }: Props) {
  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <ServerStats />
        <UpgradeInfo
          editionNotice="You are running the open-source version of Grafana.
        You have to install the Enterprise edition in order enable Enterprise features."
        />
      </Page.Contents>
    </Page>
  );
}

const titleStyles = { fontWeight: 500, fontSize: '26px', lineHeight: '123%' };

interface UpgradeInfoProps {
  editionNotice?: string;
}

export const UpgradeInfo = ({ editionNotice }: UpgradeInfoProps) => {
  const styles = useStyles2(getStyles);

  return (
    <>
      <h2 className={styles.title}>Enterprise license</h2>
      <LicenseChrome header="Grafana Enterprise" subheader="Get your free trial" editionNotice={editionNotice}>
        <div className={styles.column}>
          <FeatureInfo />
          <ServiceInfo />
        </div>
      </LicenseChrome>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    column: css`
      display: grid;
      grid-template-columns: 100%;
      column-gap: 20px;
      row-gap: 40px;

      @media (min-width: 1050px) {
        grid-template-columns: 50% 50%;
      }
    `,
    title: css`
      margin: ${theme.spacing(4)} 0;
    `,
  };
};

const GetEnterprise = () => {
  return (
    <div style={{ marginTop: '40px', marginBottom: '30px' }}>
      <h2 style={titleStyles}>Get Grafana Enterprise</h2>
      <CallToAction />
      <p style={{ paddingTop: '12px' }}>
        You can use the trial version for free for 30 days. We will remind you about it five days before the trial
        period ends.
      </p>
    </div>
  );
};

const CallToAction = () => {
  return (
    <LinkButton
      variant="primary"
      size="lg"
      href="https://grafana.com/contact?about=grafana-enterprise&utm_source=grafana-upgrade-page"
    >
      Contact us and get a free trial
    </LinkButton>
  );
};

const ServiceInfo = () => {
  return (
    <div>
      <h4>At your service</h4>

      <List>
        <Item title="Enterprise Plugins" image="public/img/licensing/plugin_enterprise.svg" />
        <Item title="Critical SLA: 2 hours" image="public/img/licensing/sla.svg" />
        <Item title="Unlimited Expert Support" image="public/img/licensing/customer_support.svg">
          24 x 7 x 365 support via
          <List nested={true}>
            <Item title="Email" />
            <Item title="Private Slack channel" />
            <Item title="Phone" />
          </List>
        </Item>
        <Item title="Hand-in-hand support" image="public/img/licensing/handinhand_support.svg">
          in the upgrade process
        </Item>
      </List>

      <div style={{ marginTop: '20px' }}>
        <strong>Also included:</strong>
        <br />
        Indemnification, working with Grafana Labs on future prioritization, and training from the core Grafana team.
      </div>

      <GetEnterprise />
    </div>
  );
};

const FeatureInfo = () => {
  return (
    <div style={{ paddingRight: '11px' }}>
      <h4>Enhanced functionality</h4>
      <FeatureListing />
    </div>
  );
};

const FeatureListing = () => {
  return (
    <List>
      <Item title="Data source permissions" />
      <Item title="Reporting" />
      <Item title="SAML authentication" />
      <Item title="Enhanced LDAP integration" />
      <Item title="Team Sync">LDAP, GitHub OAuth, Auth Proxy, Okta</Item>
      <Item title="White labeling" />
      <Item title="Auditing" />
      <Item title="Settings updates at runtime" />
      <Item title="Grafana usage insights">
        <List nested={true}>
          <Item title="Sort dashboards by popularity in search" />
          <Item title="Find unused dashboards" />
          <Item title="Dashboard usage stats drawer" />
          <Item title="Dashboard presence indicators" />
        </List>
      </Item>
      <Item title="Enterprise plugins">
        <List nested={true}>
          <Item title="Oracle" />
          <Item title="Splunk" />
          <Item title="Service Now" />
          <Item title="Dynatrace" />
          <Item title="New Relic" />
          <Item title="DataDog" />
          <Item title="AppDynamics" />
          <Item title="SAP HANA®" />
          <Item title="Gitlab" />
          <Item title="Honeycomb" />
          <Item title="Jira" />
          <Item title="MongoDB" />
          <Item title="Salesforce" />
          <Item title="Snowflake" />
          <Item title="Wavefront" />
        </List>
      </Item>
    </List>
  );
};

interface ListProps {
  nested?: boolean;
}

const List = ({ children, nested }: React.PropsWithChildren<ListProps>) => {
  const listStyle = css`
    display: flex;
    flex-direction: column;
    padding-top: 8px;

    > div {
      margin-bottom: ${nested ? 0 : 8}px;
    }
  `;

  return <div className={listStyle}>{children}</div>;
};

interface ItemProps {
  title: string;
  image?: string;
}

const Item = ({ children, title, image }: React.PropsWithChildren<ItemProps>) => {
  const imageUrl = image ? image : 'public/img/licensing/checkmark.svg';
  const itemStyle = css`
    display: flex;

    > img {
      display: block;
      height: 22px;
      flex-grow: 0;
      padding-right: 12px;
    }
  `;
  const titleStyle = css`
    font-weight: 500;
    line-height: 1.7;
  `;

  return (
    <div className={itemStyle}>
      <img src={imageUrl} alt="" />
      <div>
        <div className={titleStyle}>{title}</div>
        {children}
      </div>
    </div>
  );
};

const mapStateToProps = (state: StoreState) => ({
  navModel: getNavModel(state.navIndex, 'upgrading'),
});

export default connect(mapStateToProps)(UpgradePage);
