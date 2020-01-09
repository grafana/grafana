import React, { PureComponent } from 'react';
import { NavModel } from '@grafana/data';
import Page from '../../core/components/Page/Page';
import { LicenseChrome, Orbit } from './LicenseChrome';
import { Button } from '@grafana/ui';
import { hot } from 'react-hot-loader';
import { StoreState } from '../../types';
import { getNavModel } from '../../core/selectors/navModel';
import { connect } from 'react-redux';

interface Props {
  navModel: NavModel;
}

export class UpgradePage extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);
  }

  async componentDidMount() {}

  render() {
    const { navModel } = this.props;

    return (
      <Page navModel={navModel}>
        <Page.Contents>
          <div className="page-container page-body">
            <UpgradeInfo />
          </div>
        </Page.Contents>
      </Page>
    );
  }
}

const title = { fontWeight: 600, fontSize: '26px', lineHeight: '123%' };

export class Experiments {
  LargerCTA?: boolean;
  HeaderCTA?: boolean;
}

export const ExperimentsContext = React.createContext(new Experiments());

export function UpgradeInfo() {
  const experiments = React.useContext(ExperimentsContext);
  const subheader = experiments.HeaderCTA ? (
    <CallToAction larger={experiments.LargerCTA} />
  ) : (
    <h3>Get your free trial</h3>
  );

  return (
    <React.Fragment>
      <div className="grafana-info-box span8">
        You are running the open-source version of Grafana. With this version, you cannot run Grafana Enterprise so all
        enterprise features are disabled.
      </div>

      <LicenseChrome header="Grafana Enterprise" subheader={subheader}>
        <ServiceInfo />
        <FeatureInfo />
        <Footer />
      </LicenseChrome>
    </React.Fragment>
  );
}

function Footer() {
  const experiments = React.useContext(ExperimentsContext);

  return (
    <React.Fragment>
      <div style={{ marginTop: '40px' }}>
        <h2 style={title}>Get Grafana Enterprise</h2>
        {!experiments.HeaderCTA && <CallToAction larger={experiments.LargerCTA} />}
        <p>
          You can use the trial version for free for <strong>30 days</strong>. We will remind you about it
          <strong>5 days before the trial period ends</strong>.
        </p>
      </div>

      <div style={{ position: 'relative', height: '219px', overflow: 'hidden' }}>
        <Orbit
          size="315px"
          style={{
            top: '9px',
            right: '-40px',
          }}
        />

        <Orbit
          size="138px"
          style={{
            top: '39px',
            right: '238px',
          }}
        />
      </div>
    </React.Fragment>
  );
}

function CallToAction({ larger }: { larger?: boolean }) {
  const size = larger ? 'lg' : 'md';
  return (
    <Button
      variant="secondary"
      size={size}
      onClick={() =>
        (window.location.href = 'https://grafana.com/contact?about=grafana-enterprise&utm_source=grafana-upgrade-page')
      }
    >
      Contact us and get a free trial
    </Button>
  );
}

function ServiceInfo() {
  return (
    <div>
      <h4>At your service</h4>

      <List>
        <Item title="Premium Plugins" image="/public/img/licensing/plugin_enterprise.svg" />
        <Item title="Critical SLA: 2 hours" image="/public/img/licensing/sla.svg" />
        <Item title="Unlimited Expert Support" image="/public/img/licensing/customer_support.svg">
          24x7x365 support via
          <List>
            <Item title="Email" />
            <Item title="Private slack channel" />
            <Item title="Phone" />
          </List>
        </Item>
        <Item title="Hand-in-hand support" image="/public/img/licensing/handinhand_support.svg">
          in the upgrade process
        </Item>
      </List>
    </div>
  );
}

function FeatureInfo() {
  return (
    <div style={{ paddingRight: '11px' }}>
      <h4>Enhanced Functionality</h4>
      <FeatureListing />

      <div style={{ marginTop: '20px' }}>
        <strong>Also included:</strong>
        <br />
        private labelling, indemnification, working with Grafana Labs on future prioritization, and training from the
        core Grafana team.
      </div>
    </div>
  );
}

function FeatureListing() {
  return (
    <List>
      <Item title="Multiple Grafana instances" />
      <Item title="Premium Plugins">Oracle, Splunk, New Relic, Service Now, Dynatrace, DataDog, AppDynamics</Item>
      <Item title="Team Sync">LDAP, GitHub OAuth, Auth Proxy</Item>
      <Item title="Data source permissions" />
      <Item title="Enhanced LDAP Integration" />
      <Item title="SAML Authentication Reporting" />
    </List>
  );
}

interface ListProps {
  children: React.ReactNode;
}

class List extends React.PureComponent<ListProps> {
  constructor(props: ListProps) {
    super(props);
  }

  render() {
    return <ul style={{ paddingLeft: '1em' }}>{this.props.children}</ul>;
  }
}

interface ItemProps {
  title: string;
  image?: string;
  children?: React.ReactNode;
}

class Item extends React.PureComponent<ItemProps> {
  constructor(props: ItemProps) {
    super(props);
  }

  render() {
    const { title, image } = this.props;
    const imageUrl = image ? image : '/public/img/licensing/checkmark.svg';

    return (
      <li
        style={{
          listStyleImage: "url('" + imageUrl + "')",
        }}
      >
        <div style={{ fontWeight: 500 }}>{title}</div>
        {this.props.children && <React.Fragment>{this.props.children}</React.Fragment>}
      </li>
    );
  }
}

const mapStateToProps = (state: StoreState) => ({
  navModel: getNavModel(state.navIndex, 'upgrading'),
});

export default hot(module)(connect(mapStateToProps)(UpgradePage));
