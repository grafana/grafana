import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import {
  useStyles2,
  Alert,
  Box,
  Button,
  Field,
  Icon,
  Input,
  Label,
  Stack,
  Text,
  TextLink,
  Tooltip
} from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import config from 'app/core/config';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { Loader } from 'app/features/plugins/admin/components/Loader';
import {
  LdapSsoSettings,
  StoreState,
} from 'app/types';

import { LdapDrawer } from './LdapDrawer';

interface OwnProps extends GrafanaRouteComponentProps<{}, { username?: string }> {
  ldapSsoSettings?: LdapSsoSettings;
}

const mapStateToProps = (state: StoreState) => ({
  ldapSsoSettings: state.ldap.ldapSsoSettings,
});

const mapDispatchToProps = {};

const connector = connect(mapStateToProps, mapDispatchToProps);
type Props = OwnProps & ConnectedProps<typeof connector>;

interface FormModel {
  serverHost: string;
  bindDN: string;
  bindPassword: string;
  searchFilter: string;
  searchBaseDns: string;
}

const pageNav: NavModelItem = {
  text: 'LDAP',
  icon: 'shield',
  id: 'LDAP',
};

const subTitle = (
  <div>
    The LDAP integration in Grafana allows your Grafana users to log in with
    their LDAP credentials. Find out more in our{' '}
    <a className="external-link" href={`https://grafana.com/docs/grafana/latest/setup-grafana/configure-security/configure-authentication/ldap/`}>
      documentation
    </a>
    .
  </div>
);

export const LdapSettingsPage = ({
}: Props): JSX.Element => {
  const [isLoading, setIsLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false); // TODO: change to false
  const [settings, setSettings] = useState<LdapSsoSettings>({});
  const { register, handleSubmit } = useForm<FormModel>();
  const styles = useStyles2(getStyles);

  useEffect(() => {
    async function init() {
      const result = await getBackendSrv().get('/api/v1/sso-settings/ldap');
      // Recover only the first server mapping found
      const serverSettings = result.settings?.config?.servers[0];
      const settings: LdapSsoSettings = {
        data: serverSettings, // TODO: remove this
        attributes: {
          ...serverSettings?.attributes,
          memberOf: serverSettings?.attributes?.member_of,
        },
        bindDn: serverSettings?.bind_dn,
        bindPassword: serverSettings?.bind_password,
        groupMappings: serverSettings?.group_mappings.map((gp: any) => ({
          groupDn: gp.group_dn,
          orgId: gp.org_id,
          orgRole: gp.org_role
        })),
        host: serverSettings?.host,
        searchBaseDn: serverSettings?.search_base_dns.join(', '),
        searchFilter: serverSettings?.search_filter,
      };
      setSettings(settings);
      setIsLoading(false);
    };
    init();
  }, []);

  // Display warning if the feature flag is disabled
  if (!config.featureToggles.ssoSettingsLDAP) {
    return (
      <Alert title="invalid configuration">This page is only accessible by enabling the <strong>ssoSettingsLDAP</strong> feature flag.</Alert>
    );
  }

  const submitLdapSettings = ({ }: FormModel) => {
    console.log('submitLdapSettings')
  };

  // Button's Actions
  const saveForm = () => {
    console.log('saveForm')
  };
  const discardForm = () => {
    console.log('discardForm', settings)
    // TODO: add a confirmation dialog
  };
  const openDrawer = () => {
    setIsDrawerOpen(true);
  };
  const onChange = (settings: LdapSsoSettings) => {
    setSettings({...settings});
  };

  const passwordTooltip = (
    <Tooltip
      content={
        <>
          We recommend using variable expansion for bind password, for more information visit our <TextLink href="https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/#variable-expansion" external>documentation</TextLink>.
        </>
      }
      interactive={true}>
      <Icon name="info-circle" />
    </Tooltip>
  );
  const passwordLabel = (
    <Label description={'If the password contains “#” or “;” you have to wrap it with triple quotes. E.g. """#password;""".'}>
      <Stack>
        Bind password
        {passwordTooltip}
      </Stack>
    </Label>
  );

  return (
    <Page navId="authentication" pageNav={pageNav} subTitle={subTitle}>
      <Page.Contents>
        { isLoading && <Loader /> }
        { !isLoading && settings && <section className={styles.form}>
          <h3>Basic Settings</h3>
          <form onSubmit={handleSubmit(submitLdapSettings)}>
            <Field
              id="serverHost"
              description="Hostname or IP address of the LDAP server you wish to connect to."
              label="Server host">
                <Input
                  id="serverHost"
                  placeholder="example: 127.0.0.1"
                  type="text"
                  defaultValue={settings.host}
                  onChange={e => onChange({...settings, host: e.currentTarget.value})}
                />
            </Field>
            <Field
              label="Bind DN"
              description="Distinguished name of the account used to bind and authenticate to the LDAP server.">
                <Input
                  {...register('bindDN', { required: false })}
                  id="bindDN"
                  placeholder="example: cn=admin,dc=grafana,dc=org"
                  type="text"
                  value={settings.bindDn}/>
            </Field>
            <Field
              label={passwordLabel}>
                <Input
                  {...register('bindPassword', { required: false })}
                  id="bindPassword"
                  type="text"
                  value={settings.bindPassword}/>
            </Field>
            <Field
              label="Search filter*"
              description="LDAP search filter used to locate specific entries within the directory.">
                <Input
                  {...register('searchFilter', { required: true })}
                  id="searchFilter"
                  placeholder="example: cn=%s"
                  type="text"
                  value={settings.searchFilter}/>
            </Field>
            <Field
              label="Search base DNS *"
              description="An array of base dns to search through; separate by commas or spaces.">
                <Input
                  {...register('searchBaseDns', { required: true })}
                  id="searchBaseDns"
                  placeholder='example: "dc=grafana.dc=org"'
                  type="text"
                  value={settings.searchBaseDn}
                  />
            </Field>
            <Box
              borderColor="strong"
              borderStyle="solid"
              padding={2}
              width={68}>
                <Stack
                  alignItems={"center"}
                  direction={"row"}
                  gap={2}
                  justifyContent={'space-between'}>
                  <Stack alignItems={"start"} direction={"column"}>
                    <Text element="h2">Advanced Settings</Text>
                    <Text>Mappings, extra security measures, and more.</Text>
                  </Stack>
                  <Button variant='secondary' onClick={openDrawer}>Edit</Button>
                </Stack>
            </Box>
            <Box display={'flex'} gap={2} marginTop={5}>
              <Stack alignItems={'center'} gap={2}>
                <Button type={'submit'}>
                  Save and enable
                </Button>
                <Button variant='secondary' onClick={saveForm}>
                  Save
                </Button>
                <Button variant='secondary' onClick={discardForm}>
                  Discard
                </Button>
              </Stack>
            </Box>
          </form>
        </section>}
        {isDrawerOpen && <LdapDrawer
          ldapSsoSettings={settings}
          onChange={returnSettings => setSettings({...settings, ...returnSettings})}
          onClose={() => setIsDrawerOpen(false)} />}
      </Page.Contents>
    </Page>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    box: css({
      marginTop: theme.spacing(5),
      padding: theme.spacing(2),
      width: theme.spacing(68),
    }),
    disabledSection: css({
      padding: theme.spacing(2),
    }),
    form: css({
      'input': css({
        width: theme.spacing(68),
      }),
    }),
  };
}

export default connector(LdapSettingsPage);
