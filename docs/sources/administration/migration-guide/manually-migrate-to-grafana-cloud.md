---
description: Migrate from Grafana OSS/Enterprise to Grafana Cloud manually
keywords:
  - Grafana Cloud
  - Grafana Enterprise
  - Grafana OSS
menuTitle: Manually migrate to Grafana Cloud
title: Migrate from Grafana OSS/Enterprise to Grafana Cloud manually
weight: 300
---

# Migrate from Grafana OSS/Enterprise to Grafana Cloud manually

This migration guide is designed to assist Grafana OSS/Enterprise users in seamlessly transitioning manually to Grafana Cloud.

{{< admonition type="note" >}}
There isn't yet a standard method for importing existing data into Grafana Cloud from self-managed databases.
{{< /admonition >}}

{{< admonition type="tip" >}}
You can use the [Grafana Cloud Migration Assistant](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/migration-guide/cloud-migration-assistant/), generally available in Grafana v12, to automatically migrate your resources to Grafana Cloud.
{{< /admonition >}}

## Plan and perform a manual migration

If you need to migrate resources beyond what is supported by the Grafana Cloud Migration Assistant, you can migrate them manually with this guide. Moving your team from Grafana OSS/Enterprise to Grafana Cloud manually involves some coordination and communication in addition to the technical migration in the following documentation.

If you are an existing Grafana OSS/Enterprise customer, contact your account team at Grafana Labs to plan a transition period, arrange licenses, and learn how much your Grafana Cloud subscription costs in comparison to Grafana OSS/Enterprise. The account team can also offer specific guidance and arrange professional services to assist with your migration if needed.

Evaluate Grafana Cloud's security and compliance policies at the [Grafana Labs Trust Center](https://trust.grafana.com/).

You may choose to test Grafana Cloud for some time before migrating your entire organization. To do so, set up a “test” stack in Cloud and migrate resources there first. If you use Grafana Alerting, make sure to set up a different contact point so that alerts do not fire twice.

When you decide to migrate, set aside a day of cutover during which users should not create new dashboards or alerts. Migrate any newly-created resources, turn on your production Alerting contact points and notification policies in Cloud and turn them off in Grafana OSS/Enterprise, and notify your users. You may also choose to redirect the Grafana OSS/Enterprise URL to your Grafana Cloud URL.

| Component    | Migration Effort | Notes                                                                     |
| ------------ | ---------------- | ------------------------------------------------------------------------- |
| Folders      | Low              |                                                                           |
| Dashboards   | Low              | Data source references might need to be renamed                           |
| Alerts       | Medium           | Data source based alerts might need to be adapted                         |
| Plugins      | Medium           | Depends on the feature set of the plugin                                  |
| Data sources | High             | If the data sources reference any secrets, you need to provide them again |

## Before you begin

Ensure you have the following:

- A [Grafana Cloud Stack](https://grafana.com/docs/grafana-cloud/get-started/) and access to a Linux Machine (or a working WSL2 installation) to run the code snippets in this guide.
- Administrator access to a Grafana Cloud stack. To check you access level, Go to `https://grafana.com/orgs/<your-org-name>/members`
- Administrator access to your existing Grafana OSS/Enterprise instance. To check your access level, Go to `https://<grafana-onprem-url>/admin/users`
- Access to the credentials used to connect to your data sources. For example, API keys or usernames and passwords. Since this information is encrypted, it cannot be copied from one instance to the other.
- If some of your data sources are only available from inside your network, refer to the requirements for [Private Data Source Connect](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/)
- For Plugins, Reports and Playlists only: The [curl](https://github.com/curl/curl) and [jq](https://jqlang.github.io/jq/download/) command line tools

## Upgrade Grafana OSS/Enterprise to the latest version

Grafana Cloud stacks generally run the latest version of Grafana. In order to avoid issues during migration, upgrade Grafana by following our guides [here](https://grafana.com/docs/grafana/latest/upgrade-guide/).

## Migrate Grafana resources

In this guide, the term **"resources"** refers to things you create in Grafana, like dashboards, folders, alerts, data sources, and permissions.

The process of migration works by pulling the existing resources (like dashboards and folders) from the old Grafana instance, modifying them if necessary, and then pushing them to the new Grafana Cloud instance.

In the provided code snippets throughout this migration guide, you need to substitute specific placeholders with your actual credentials and instance URLs. Make the following replacements before executing the scripts:

- `$GRAFANA_SOURCE_TOKEN` with the access token from your Grafana OSS/Enterprise instance.
- `$GRAFANA_DEST_TOKEN` with the access token from your Grafana Cloud instance.
- `$GRAFANA_ONPREM_INSTANCE_URL` with the URL of your Grafana OSS/Enterprise instance. For example: `https://grafana.mydomain.com`
- `$GRAFANA_CLOUD_INSTANCE_URL` with the URL of your Grafana Cloud instance. For example: `https://myorganization.grafana.net`

### Migrate Grafana Plugins

Migration of plugins is the first step when transitioning from Grafana OSS/Enterprise to Grafana Cloud, given that plugins are integral components that influence the functionality and display of other Grafana resources, such as dashboards.

1. To retrieve the Plugins installed in your Grafana OSS/Enterprise instance, issue an HTTP GET request to the `/api/plugins` endpoint. Use the following shell command:

   ```shell
   response=$(curl -s -H "Accept: application/json" -H "Authorization: Bearer $GRAFANA_SOURCE_TOKEN" "${GRAFANA_ONPREM_INSTANCE_URL}/api/plugins")

   plugins=$(echo $response | jq '[.[] | select(.signatureType == "community" or (.signatureType != "internal" and .signatureType != "")) | {name: .id, version: .info.version}]')

   echo "$plugins" > plugins.json
   ```

   The command provided above will carry out an HTTP request to this endpoint and accomplish several tasks:
   - It issues a GET request to the `/api/plugins` endpoint of your Grafana OSS/Enterprise instance to retrieve a list of installed plugins.
   - It filters out the list to only include community plugins and those signed by external parties.
   - It extracts the plugin ID and version before storing them in a `plugins.json` file.

1. To import the plugins in your Grafana Cloud Instance, execute the following command. This command constructs an HTTP POST request to `https://grafana.com/api/instances/<stack_slug>/plugins`

   ```shell
   CLOUD_INSTANCE=$GRAFANA_CLOUD_INSTANCE_URL

   stack_slug="${CLOUD_INSTANCE#*//}"
   stack_slug="${stack_slug%%.*}"
   jq -c '.[]' plugins.json | while IFS= read -r plugin; do
     name=$(echo "$plugin" | jq -r '.name')
     version=$(echo "$plugin" | jq -r '.version')
     echo "Adding plugin $name with version $version to stack $stack_slug"
     response=$(curl -s -X POST "https://grafana.com/api/instances/$stack_slug/plugins" \
               -H "Authorization: Bearer <GRAFANA_CLOUD_ACCESS_TOKEN>" \
               -H "Content-Type: application/json" \
               -d "{\"plugin\": \"$name\", \"version\": \"$version\"}")
     echo "POST response for plugin $name version $version: $response"
   done
   ```

   Replace `<GRAFANA_CLOUD_ACCESS_TOKEN>` with your Grafana Cloud Access Policy Token. To create a new one, refer to Grafana Cloud [access policies documentation](https://grafana.com/docs/grafana-cloud/account-management/authentication-and-permissions/access-policies/)

   This script iterates through each plugin listed in the `plugins.json` file:
   - It constructs a POST request for each plugin to add it to the specified Grafana Cloud instance.
   - It reports back the response for each POST request to give you confirmation or information about any issues that occurred.

### Migrate resources that are already provisioned as-code

If you already use tools like [Terraform](https://grafana.com/docs/grafana-cloud/developer-resources/infrastructure-as-code/terraform/), [Ansible](https://grafana.com/docs/grafana-cloud/developer-resources/infrastructure-as-code/ansible/), or [Grafana’s HTTP API](https://grafana.com/docs/grafana-cloud/developer-resources/api-reference/http-api/) to provision resources to Grafana, redirect those to the new Grafana Cloud instance by replacing the Grafana URL and credentials.

### Migrate dashboards, folders, data sources, library panels, and alert rules using Grizzly

Grizzly is a command line tool that streamlines working with Grafana resources. Use it to migrate most of the content in your Grafana instance. Follow these steps in your terminal to install Grizzly. If you need to change the os or the architecture, Refer to the Grizzly [releases](https://github.com/grafana/grizzly/releases) and use the binary according to your needs.

```shell
# download the binary (adapt os and arch as needed)
$ curl -fSL -o "/usr/local/bin/grr" "https://github.com/grafana/grizzly/releases/download/v0.3.1/grr-linux-amd64"

# make it executable
$ chmod a+x "/usr/local/bin/grr"

# have fun :)
$ grr --help
```

First, create a new folder on your computer and navigate to it to keep your work organized.

```shell
mkdir grafana-migration
cd grafana-migration
```

To give grizzly access to your Grafana OSS/Enterprise instance and the Grafana Cloud Instance, you need to create a [service account](https://grafana.com/docs/grafana-cloud/account-management/authentication-and-permissions/service-accounts/) and a corresponding [access token](https://www.grafana.com/docs/grafana-cloud/account-management/authentication-and-permissions/service-accounts/#service-account-tokens) on each instance. You can use these tokens to authenticate requests to pull and push resources. Follow these steps on your Grafana OSS/Enterprise instance:

- Navigate to the **Administration -> Users and access -> Service Accounts** Page within the Grafana OSS/Enterprise instance.
- Click on **Add Service Account**
- Give the Service account a descriptive name like “grizzly-migration” and apply the **Admin** role.
- After creating the account, click on **Add Service Account Token**
- Enter a name for the token
- Select **Set expiration date** and enter an expiry date for the token
- Click **Generate Token** and save this token in a password manager or other secure place.

Complete the service account creation and token generation process for your Grafana Cloud Instance by following the same steps outlined above for your Grafana OSS/Enterprise instance. This ensures that Grizzly has the necessary access token for both platforms.

Next, to tell grizzly which instances you’re going to work on, use the following commands:

```shell
grr config create-context grafana-onprem
grr config use-context grafana-onprem
grr config set output-format json
grr config set grafana.url $GRAFANA_ENT_INSTANCE_URL
grr config set grafana.token $GRAFANA_SOURCE_TOKEN

grr config create-context grafana-cloud
grr config use-context grafana-cloud
grr config set output-format json
grr config set grafana.url $GRAFANA_CLOUD_INSTANCE_URL
grr config set grafana.token $GRAFANA_DEST_TOKEN
```

Afterward, you will have two contexts set up; one for your local Grafana OSS/Enterprise installation and one for Grafana Cloud. The `grr config use-context` command allows you to switch between the two instances while using Grizzly.

#### Export existing resources

Switch to the `grafana-onprem` context and use the pull command to fetch the resources you want to migrate:

```shell
grr config use-context grafana-onprem
grr pull . \
  -t 'Dashboard/*' \
  -t 'Datasource/*' \
  -t 'DashboardFolder/*' \
  -t 'LibraryElement/*' \
  -t 'AlertRuleGroup/*' \
  -t 'AlertContactPoint/*' \
  -t 'AlertNotificationPolicy/*'
```

This will fetch the specified resources from Grafana and store them in the current directory.

#### Push the resources to your Grafana Cloud stack

With everything in place, switch to the Grafana cloud context and use the following commands to apply the resources to the configured instance:

```shell
grr config use-context grafana-cloud

grr apply . -t 'DashboardFolder/*'
grr apply . -t 'LibraryElement/*'
grr apply . -t 'Datasource/*'
grr apply . -t 'Dashboard/*'
grr apply . -t 'AlertRuleGroup/*'
grr apply . -t 'AlertContactPoint/*'
grr apply . -t 'AlertNotificationPolicy/*'
```

#### Fill in data source credentials

After migrating your data sources, you must fill in their credentials, like tokens, usernames, or passwords. For security reasons, grizzly cannot read encrypted data source credentials from the existing Grafana instance.

To fill in the missing authentication information, go to the **Connections -> Datasources** page in your new Grafana Cloud instance and verify that credentials for all data sources are set. You can skip data sources starting with `grafanacloud` - These are managed by Grafana Cloud directly and provide access to Grafana Cloud databases.

If one of your data sources can only be accessed from your internal network, take a look at the [Private Data Source Connect documentation](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/).

After you have configured the data sources, all your dashboards should be available as they were before.

##### (Optional) Configure Private Data Source Connect (PDC)

This step only applies if you use Grafana OSS/Enterprise to access network-secured data sources.

Some data sources, like Prometheus or SQL databases, live on private networks or behind fire wall rules that are not accessible by Grafana Cloud. If your Grafana OSS/Enterprise instance was hosted on the same network as your data source, you might find that Grafana Cloud cannot connect to all of the same data sources that Grafana OSS/Enterprise could access.

To access these data sources from Grafana Cloud, follow our guide to [configure PDC in your network](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/configure-pdc/), and then configure the applicable Grafana data sources to [connect using PDC](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/configure-pdc/#configure-a-data-source-to-use-private-data-source-connect-pdc). Note that PDC is only needed for your network-secured data sources, not for data sources like Splunk or CloudWatch that are accessible over the public internet.

For more information on how PDC works, see our [overview document](/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/).

### Migrate reports and playlists using Grafana’s HTTP API

Grizzly does not currently support Reports and Playlists as a resource, so you can perform this migration using Grafana’s HTTP API using the `curl` command.

#### Reports (For Grafana Enterprise only)

1. To export your Reports, you will need to invoke the `api/reports` endpoint of your Grafana OSS/Enterprise instance. The below shell command accomplishes this by using `curl` to send a request to the endpoint and then stores the retrieved report configuration into a file named `reports.json`.

   ```shell
   curl ${GRAFANA_ONPREM_INSTANCE_URL}/api/reports -H "Authorization: Bearer $GRAFANA_SOURCE_TOKEN" > reports.json
   ```

2. To upload the configuration data you have saved in the `reports.json` file to your new Grafana Cloud instance, run the below command. The command will take the local file `reports.json` and push its contents to the `api/reports` endpoint of your Grafana Cloud instance.

   ```shell
   jq -M -r -c '.[]' < reports.json | while read -r json; do curl -XPOST ${GRAFANA_CLOUD_INSTANCE_URL}/api/reports -H"Authorization: Bearer $GRAFANA_DEST_TOKEN" -d"$json" -H 'Content-Type: application/json'; done
   ```

#### Playlists

1. To retrieve the Playlists from your Grafana OSS/Enterprise instance, issue an HTTP GET request to the `/api/playlists` endpoint. Use the following shell command:

   ```shell
   mkdir playlists
   curl "${GRAFANA_ONPREM_INSTANCE_URL}/api/playlists" \
   -H "Authorization: Bearer $GRAFANA_SOURCE_TOKEN" \
   | jq -M -r -c '.[] | .uid' \
   | while read -r uid; do \
   curl "${GRAFANA_ONPREM_INSTANCE_URL}/api/playlists/$uid" \
       -H "Authorization: Bearer $GRAFANA_SOURCE_TOKEN" \
       > playlists/$uid.json; \
   done
   ```

   The command provided above will carry out an HTTP request to this endpoint and accomplish several tasks:
   - It fetches an array of all the playlists available in the Grafana OSS/Enterprise instance.
   - It then iterates through each playlist to obtain the complete set of details.
   - Finally, it stores each playlist's specification as separate JSON files within a directory named `playlists`

2. To import the playlists, execute the following command. This command constructs an HTTP POST request targeting the `/api/playlists` endpoint of your Grafana Cloud Instance.

   ```shell
   for playlist in playlists/*; do
     curl -XPOST "${GRAFANA_CLOUD_INSTANCE_URL}/api/playlists" \
       -H "Authorization: Bearer $GRAFANA_DEST_TOKEN" \
       -H "Content-Type: application/json" \
       -d $playlist > /dev/null;
   done
   ```

### Migrate single sign-on configuration

Grafana Cloud stacks support all of the same authentication and authorization options as Grafana OSS/Enterprise, except for [anonymous authentication](https://grafana.com/docs/grafana/latest/setup-grafana/configure-security/configure-authentication/anonymous-auth/) and use of the [Auth proxy](https://grafana.com/docs/grafana/latest/setup-grafana/configure-security/configure-authentication/auth-proxy/). However, single sign-on settings cannot be exported and imported like dashboards, alerts, and other resources.

To set up SAML authentication from scratch using Grafana’s UI or API, follow [these instructions](https://grafana.com/docs/grafana/latest/setup-grafana/configure-security/configure-authentication/saml-ui/) to Configure SAML authentication in Grafana.

LDAP and OIDC/OAuth2 can only be configured in Grafana Cloud by the Grafana Labs support team. Follow [these instructions](https://grafana.com/docs/grafana-cloud/account-management/authentication-and-permissions/) to request SSO configuration from the support team.

### Migrate custom Grafana configuration

You may have customized the [configuration](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/) of your Grafana OSS/Enterprise instance, for example with feature toggles, custom auth, or embedding options. Since Grafana configuration is stored in environment variables or the filesystem where Grafana runs, Grafana Cloud users do not have access to it. However, you can open a support ticket to ask a Grafana Labs support engineer for customizations.

The following customizations are available via support:

- Enabling [feature toggles](http://www.grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/feature-toggles).
- [Single sign-on and team sync using SAML, LDAP, or OAuth](http://www.grafana.com/docs/grafana/latest/setup-grafana/configure-security/configure-authentication).
- Enable [embedding Grafana dashboards in other applications](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/#allow_embedding) for Grafana Cloud contracted customers.
- [Audit logging](https://grafana.com/docs/grafana/latest/setup-grafana/configure-security/audit-grafana/) ([Usage insights logs and dashboards](https://grafana.com/docs/grafana-cloud/account-management/usage-insights/) are available in Grafana Cloud Pro and Advanced by default).

Note that the following custom configurations are not supported in Grafana Cloud:

- [Anonymous user access](https://grafana.com/docs/grafana/latest/setup-grafana/configure-security/configure-authentication/anonymous-auth/).
- [Auth proxy](https://grafana.com/docs/grafana/latest/setup-grafana/configure-security/configure-authentication/auth-proxy/).
- [Third-party database encryption](https://grafana.com/docs/grafana/latest/setup-grafana/configure-security/configure-database-encryption/) and the [Hashicorp Vault](https://grafana.com/docs/grafana/latest/setup-grafana/configure-security/configure-database-encryption/encrypt-secrets-using-hashicorp-key-vault/) integration.
- Running self-signed plugins, like custom-built data sources or visualizations. For more information on plugin signing, refer to our [developer documentation](https://grafana.com/developers/plugin-tools/publish-a-plugin/sign-a-plugin).

If you have a custom configuration in Grafana OSS/Enterprise that is not listed here, reach out to our support team to find out whether they can help you set it up.

## Next steps

After you have successfully migrated resources and configuration from Grafana OSS/Enterprise, consider the following steps to enhance your monitoring experience:

- **Get started with Grafana Cloud**: learn more about the functionality available in Grafana Cloud, which is not available in the open source or Enterprise editions. Read more in [Get started with Grafana Cloud](https://grafana.com/docs/grafana-cloud/get-started/)
- **AWS PrivateLink for Grafana Cloud**: securely transmit telemetry data from your AWS Virtual Private Cloud (VPC) to Grafana Cloud, entirely within the AWS network.
  Learn how to set this up with [AWS PrivateLink Integration](https://grafana.com/docs/grafana-cloud/send-data/aws-privatelink/).
- **Azure PrivateLink for Grafana Cloud**, securely transmit telemetry from your Azure Virtual Network to Grafana Cloud while staying on the Azure network, and avoid exposing your traffic to the public internet.
  Learn how to set this up with [AWS PrivateLink Integration](https://grafana.com/docs/grafana-cloud/send-data/azure-privatelink/).
- **[Grafana Integrations](https://grafana.com/docs/grafana-cloud/monitor-infrastructure/integrations/)**: ready-made integrations to make monitoring your infrastructure and applications more straightforward.
