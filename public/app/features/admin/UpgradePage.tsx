import { css } from '@emotion/css';
import * as React from 'react';
import { connect } from 'react-redux';

import { GrafanaTheme2, NavModel } from '@grafana/data';
import { LinkButton, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { Trans } from 'app/core/internationalization';

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
      <h2 className={styles.title}>
        <Trans i18nKey="admin.upgrade-info.title">Enterprise license</Trans>
      </h2>
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
    column: css({
      display: 'grid',
      gridTemplateColumns: '100%',
      columnGap: '20px',
      rowGap: '40px',

      '@media (min-width: 1050px)': {
        gridTemplateColumns: '50% 50%',
      },
    }),
    title: css({
      margin: theme.spacing(4, 0),
    }),
  };
};

const GetEnterprise = () => {
  return (
    <div style={{ marginTop: '40px', marginBottom: '30px' }}>
      <h2 style={titleStyles}>
        <Trans i18nKey="admin.get-enterprise.title">Get Grafana Enterprise</Trans>
      </h2>
      <CallToAction />
      <p style={{ paddingTop: '12px' }}>
        <Trans i18nKey="admin.get-enterprise.description">
          You can use the trial version for free for 30 days. We will remind you about it five days before the trial
          period ends.
        </Trans>
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
      <Trans i18nKey="admin.get-enterprise.contact-us">Contact us and get a free trial</Trans>
    </LinkButton>
  );
};

const ServiceInfo = () => {
  return (
    <div>
      <h4>
        <Trans i18nKey="admin.get-enterprise.service-title">At your service</Trans>
      </h4>

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
        <strong>
          <Trans i18nKey="admin.get-enterprise.included-heading">Also included:</Trans>
        </strong>
        <br />
        <Trans i18nKey="admin.get-enterprise.included-description">
          Indemnification, working with Grafana Labs on future prioritization, and training from the core Grafana team.
        </Trans>
      </div>

      <GetEnterprise />
    </div>
  );
};

const FeatureInfo = () => {
  return (
    <div style={{ paddingRight: '11px' }}>
      <h4>
        <Trans i18nKey="admin.get-enterprise.features-heading">Enhanced functionality</Trans>
      </h4>
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
      <Item title="Team Sync">
        <Trans i18nKey="admin.get-enterprise.team-sync-details">LDAP, GitHub OAuth, Auth Proxy, Okta</Trans>
      </Item>
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
  const listStyle = css({
    display: 'flex',
    flexDirection: 'column',
    paddingTop: '8px',

    '> div': {
      marginBottom: `${nested ? 0 : 8}px`,
    },
  });

  return <div className={listStyle}>{children}</div>;
};

interface ItemProps {
  title: string;
  image?: string;
}

const Item = ({ children, title, image }: React.PropsWithChildren<ItemProps>) => {
  const imageUrl = image ? image : 'public/img/licensing/checkmark.svg';
  const itemStyle = css({
    display: 'flex',

    '> img': {
      display: 'block',
      height: '22px',
      flexGrow: 0,
      paddingRight: '12px',
    },
  });
  const titleStyle = css({
    fontWeight: 500,
    lineHeight: 1.7,
  });

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
