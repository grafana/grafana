+++
title = "Enterprise configuration"
description = "Enterprise configuration documentation"
keywords = ["grafana", "configuration", "documentation", "enterprise"]
weight = 300
+++

# Grafana Enterprise configuration

This page describes Grafana Enterprise-specific configuration options that you can specify in a `.ini` configuration file or using environment variables. Refer to [Configuration]({{< relref "../administration/configuration.md" >}}) for more information about available configuration options.

## [enterprise]

### license_path

Local filesystem path to Grafana Enterprise's license file.
Defaults to `<paths.data>/license.jwt`.

### license_text

> **Note:** Available in Grafana Enterprise v7.4+.

When set to the text representation (i.e. content of the license file)
of the license, Grafana will evaluate and apply the given license to
the instance.

### auto_refresh_license

> **Note:** Available in Grafana Enterprise v7.4+.

When enabled, Grafana will send the license and usage statistics to
the license issuer. If the license has been updated on the issuer's
side to be valid for a different number of users or a new duration,
your Grafana instance will be updated with the new terms
automatically. Defaults to `true`.

## [white_labeling]

### app_title

Set to your company name to override application title.

### login_logo

Set to complete URL to override login logo.

### login_background

Set to complete CSS background expression to override login background. Example:

```bash
[white_labeling]
login_background = url(http://www.bhmpics.com/wallpapers/starfield-1920x1080.jpg)
```

### menu_logo

Set to complete URL to override menu logo.

### fav_icon

Set to complete URL to override fav icon (icon shown in browser tab).

### apple_touch_icon

Set to complete URL to override Apple/iOS icon.

### footer_links

List the link IDs to use here. Grafana will look for matching link configurations, the link IDs should be space-separated and contain no whitespace.

## [meta_analytics]

### max_file_age

Max age for data files before they get deleted.

### max_data_directory_size

Max size in megabytes of the data files directory before files get deleted.

### data_path

The directory where events will be stored in.

## [analytics.summaries]

### buffer_write_interval

Interval for writing dashboard usage stats buffer to database.

### buffer_write_timeout

Timeout for writing dashboard usage stats buffer to database.

### rollup_interval

Interval for trying to roll up per dashboard usage summary. Only rolled up at most once per day.

### rollup_timeout

Timeout for trying to rollup per dashboard usage summary.

## [analytics.views]

### recent_users_age

Age for recent active users.

## [reporting]

### rendering_timeout

Timeout for each panel rendering request.

### concurrent_render_limit

Maximum number of concurrent calls to the rendering service.

### image_scale_factor

Scale factor for rendering images. Value `2` is enough for monitor resolutions, `4` would be better for printed material. Setting a higher value affects performance and memory.

## [auditing]

[Auditing]({{< relref "auditing.md" >}}) allows you to track important changes to your Grafana instance. By default, audit logs are logged to file but the auditing feature also supports sending logs directly to Loki.

### enabled

Enable the auditing feature. Defaults to false.

### loggers

List of enabled loggers.

### log_dashboard_content

Keep dashboard content in the logs (request or response fields). This can significantly increase the size of your logs.

## [auditing.logs.file]

### path

Path to logs folder.

### max_files

Maximum log files to keep.

### max_file_size_mb

Max size in megabytes per log file.

## [auditing.logs.loki]

### url

Set the URL for writing logs to Loki.

### tls

If true, it establishes a secure connection to Loki. Defaults to true.

## [auth.saml]

### enabled

If true, the feature is enabled. Defaults to false.

### certificate

Base64-encoded public X.509 certificate. Used to sign requests to the IdP.

### certificate_path

Path to the public X.509 certificate. Used to sign requests to the IdP.

### private_key

Base64-encoded private key. Used to decrypt assertions from the IdP.

### private_key_path

Path to the private key. Used to decrypt assertions from the IdP.

### idp_metadata

Base64-encoded IdP SAML metadata XML. Used to verify and obtain binding locations from the IdP.

### idp_metadata_path

Path to the SAML metadata XML. Used to verify and obtain binding locations from the IdP.

### idp_metadata_url

URL to fetch SAML IdP metadata. Used to verify and obtain binding locations from the IdP.

### max_issue_delay

Time since the IdP issued a response and the SP is allowed to process it. Defaults to 90 seconds.

### metadata_valid_duration

How long the SPs metadata is valid. Defaults to 48 hours.

### assertion_attribute_name

Friendly name or name of the attribute within the SAML assertion to use as the user name.

### assertion_attribute_login

Friendly name or name of the attribute within the SAML assertion to use as the user login handle.

### assertion_attribute_email

Friendly name or name of the attribute within the SAML assertion to use as the user email.

### assertion_attribute_groups

Friendly name or name of the attribute within the SAML assertion to use as the user groups.

### assertion_attribute_role

Friendly name or name of the attribute within the SAML assertion to use as the user roles.

### assertion_attribute_org

Friendly name or name of the attribute within the SAML assertion to use as the user organization.

### allowed_organizations

List of comma- or space-separated organizations. Each user must be a member of at least one organization to log in.

### org_mapping

List of comma- or space-separated Organization:OrgId mappings.

### role_values_editor

List of comma- or space-separated roles that will be mapped to the Editor role.

### role_values_admin

List of comma- or space-separated roles that will be mapped to the Admin role.

### role_values_grafana_admin

List of comma- or space-separated roles that will be mapped to the Grafana Admin (Super Admin) role.

## [keystore.vault]

### url

Location of the Vault server.

### namespace

Vault namespace if using Vault with multi-tenancy.

### auth_method

Method for authenticating towards Vault. Vault is inactive if this option is not set. Current possible values: `token`.

### token

Secret token to connect to Vault when auth_method is `token`.

### lease_renewal_interval

Time between checking if there are any secrets which needs to be renewed.

### lease_renewal_expires_within

Time until expiration for tokens which are renewed. Should have a value higher than lease_renewal_interval.

### lease_renewal_increment

New duration for renewed tokens. Vault may be configured to ignore this value and impose a stricter limit.
