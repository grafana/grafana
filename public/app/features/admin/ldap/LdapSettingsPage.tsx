import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { useStyles2, Box, Button, Field, Input, Stack } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import config from 'app/core/config';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { Loader } from 'app/features/plugins/admin/components/Loader';
import {
  StoreState,
} from 'app/types';


import {
  getSSOSettings,
} from '../state/actions';

interface OwnProps extends GrafanaRouteComponentProps<{}, { username?: string }> {
}

const mapStateToProps = (state: StoreState) => ({
});

const mapDispatchToProps = {
  getSSOSettings,
};

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
  getSSOSettings,
}: Props) => {
  const [isLoading, setIsLoading] = useState(true);
  const { register, handleSubmit } = useForm<FormModel>();
  const styles = useStyles2(getStyles);

  const submitLdapSettings = ({ }: FormModel) => {
    console.log('submitLdapSettings')
  };

  useEffect(() => {
    async function init() {
      await getSSOSettings();
      setIsLoading(false);
    };
    init();
  }, [getSSOSettings]);

  if (config.featureToggles.ssoSettingsLDAP) {
    return (
      <div>This page is only accessible by enabling the <strong>ssoSettingsLDAP</strong> feature flag.</div>
    );
  }

  return (
    <Page navId="authentication" pageNav={pageNav} subTitle={subTitle}>
      <Page.Contents>
        { isLoading && <Loader /> }
        { !isLoading && <section className={styles.form}>
          <h3>Basic Settings</h3>
          <form onSubmit={handleSubmit(submitLdapSettings)}>
            <Field
              description="Hostname or IP address of the LDAP server you wish to connect to."
              label="Server host">
                <Input
                  {...register('serverHost', { required: true })}
                  id="serverHost"
                  placeholder="example: 127.0.0.1"
                  type="text"/>
            </Field>
            <Field
              label="Bind DN"
              description="Distinguished name of the account used to bind and authenticate to the LDAP server.">
                <Input
                  {...register('bindDN', { required: false })}
                  id="bindDN"
                  placeholder="example: cn=admin,dc=grafana,dc=org"
                  type="text"/>
            </Field>
            <Field
              label="Bind password" // TODO: add icon
              description='If the password contains “#” or “;” you have to wrap it with triple quotes. E.g. """#password;""".'>
                <Input
                  {...register('bindPassword', { required: false })}
                  id="bindPassword"
                  type="text"/>
            </Field>
            <Field
              label="Search filter*"
              description="LDAP search filter used to locate specific entries within the directory.">
                <Input
                  {...register('searchFilter', { required: true })}
                  id="searchFilter"
                  placeholder="example: cn=%s"
                  type="text"/>
            </Field>
            <Field
              label="Search base DNS *"
              description="An array of base dns to search through; separate by commas or spaces.">
                <Input
                  {...register('searchBaseDns', { required: true })}
                  id="searchBaseDns"
                  placeholder='example: "dc=grafana.dc=org"'
                  type="text"/>
            </Field>
            <Box
              borderColor="strong"
              borderStyle="solid"
              gap={2}
              marginTop={5}
              width={68}>oli</Box>
            <Box display={'flex'} gap={2} marginTop={5}>
              <Stack alignItems={'center'} gap={2}>
                <Button type={'submit'}>
                  Save and enable
                </Button>
                <Button variant='secondary'>
                  Save
                </Button>
                <Button variant='secondary'>
                  Discard
                </Button>
              </Stack>
            </Box>
          </form>
        </section>}
      </Page.Contents>
    </Page>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    form: css(
      {
        'input': css({
          width: theme.spacing(68),
        }),
      }
    ),
  };
}

export default connector(LdapSettingsPage);
