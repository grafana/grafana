---
aliases:
  - ../../enterprise/enterprise-configuration/
description: Learn about Grafana Enterprise configuration options that you can specify.
title: Configure Grafana Enterprise
weight: 100
---

# Configure Grafana Enterprise

This page describes Grafana Enterprise-specific configuration options that you can specify in a `.ini` configuration file or using environment variables. Refer to [Configuration]({{< relref "../../configure-grafana" >}}) for more information about available configuration options.

## [enterprise]

### license_path

Local filesystem path to Grafana Enterprise's license file.
Defaults to `<paths.data>/license.jwt`.

### license_text

{{% admonition type="note" %}}
Available in Grafana Enterprise version 7.4 and later.
{{% /admonition %}}

When set to the text representation (i.e. content of the license file)
of the license, Grafana will evaluate and apply the given license to
the instance.

### auto_refresh_license

{{% admonition type="note" %}}
Available in Grafana Enterprise version 7.4 and later.
{{% /admonition %}}

When enabled, Grafana will send the license and usage statistics to
the license issuer. If the license has been updated on the issuer's
side to be valid for a different number of users or a new duration,
your Grafana instance will be updated with the new terms
automatically. Defaults to `true`.

### license_validation_type

{{% admonition type="note" %}}
Available in Grafana Enterprise version 8.3 and later.
{{% /admonition %}}

When set to `aws`, Grafana will validate its license status with Amazon Web Services (AWS) instead of with Grafana Labs. Only use this setting if you purchased an Enterprise license from AWS Marketplace. Defaults to empty, which means that by default Grafana Enterprise will validate using a license issued by Grafana Labs. For details about licenses issued by AWS, refer to [Activate a Grafana Enterprise license purchased through AWS Marketplace]({{< relref "../../../administration/enterprise-licensing/activate-aws-marketplace-license" >}}).

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

## [usage_insights.export]

By [exporting usage logs]({{< relref "../../configure-security/export-logs" >}}), you can directly query them and create dashboards of the information that matters to you most, such as dashboard errors, most active organizations, or your top-10 most-used queries.

### enabled

Enable the usage insights export feature.

### storage

Specify a storage type. Defaults to `loki`.

## [usage_insights.export.storage.loki]

### type

Set the communication protocol to use with Loki, which is either `grpc` or `http`. Defaults to `grpc`.

### url

Set the address for writing logs to Loki (format must be host:port).

### tls

Decide whether or not to enable the TLS (Transport Layer Security) protocol when establishing the connection to Loki. Defaults to true.

### tenant_id

Set the tenant ID for Loki communication, which is disabled by default. The tenant ID is required to interact with Loki running in [multi-tenant mode](/docs/loki/latest/operations/multi-tenancy/).

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

### max_attachment_size_mb

Set the maximum file size in megabytes for the CSV attachments.

### fonts_path

Path to the directory containing font files.

### font_regular

Name of the TrueType font file with regular style.

### font_bold

Name of the TrueType font file with bold style.

### font_italic

Name of the TrueType font file with italic style.

## [auditing]

[Auditing]({{< relref "../../configure-security/audit-grafana" >}}) allows you to track important changes to your Grafana instance. By default, audit logs are logged to file but the auditing feature also supports sending logs directly to Loki.

### enabled

Enable the auditing feature. Defaults to false.

### loggers

List of enabled loggers.

### log_dashboard_content

Keep dashboard content in the logs (request or response fields). This can significantly increase the size of your logs.

### verbose

Log all requests and keep requests and responses body. This can significantly increase the size of your logs.

### log_all_status_codes

Set to false to only log requests with 2xx, 3xx, 401, 403, 500 responses.

### max_response_size_bytes

Maximum response body (in bytes) to be recorded. May help reducing the memory footprint caused by auditing.

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

### tenant_id

Set the tenant ID for Loki communication, which is disabled by default. The tenant ID is required to interact with Loki running in [multi-tenant mode](/docs/loki/latest/operations/multi-tenancy/).

## [auth.saml]

### enabled

If true, the feature is enabled. Defaults to false.

### allow_sign_up

If true, allow new Grafana users to be created through SAML logins. Defaults to true.

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

Friendly name or name of the attribute within the SAML assertion to use as the user name. Alternatively, this can be a template with variables that match the names of attributes within the SAML assertion.

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

List of comma- or space-separated Organization:OrgId:Role mappings. Organization can be `*` meaning "All users". Role is optional and can have the following values: `Viewer`, `Editor` or `Admin`.

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

## [security.egress]

{{% admonition type="note" %}}
Available in Grafana Enterprise version 7.4 and later.
{{% /admonition %}}

Security egress makes it possible to control outgoing traffic from the Grafana server.

### host_deny_list

A list of hostnames or IP addresses separated by spaces for which requests are blocked.

### host_allow_list

A list of hostnames or IP addresses separated by spaces for which requests are allowed. All other requests are blocked.

### header_drop_list

A list of headers that are stripped from the outgoing data source and alerting requests.

### cookie_drop_list

A list of cookies that are stripped from the outgoing data source and alerting requests.

## [security.encryption]

### algorithm

Encryption algorithm used to encrypt secrets stored in the database and cookies. Possible values are `aes-cfb` (default) and `aes-gcm`. AES-CFB stands for _Advanced Encryption Standard_ in _cipher feedback_ mode, and AES-GCM stands for _Advanced Encryption Standard_ in _Galois/Counter Mode_.

## [caching]

{{% admonition type="note" %}}
Available in Grafana Enterprise version 7.5 and later.
{{% /admonition %}}

When query caching is enabled, Grafana can temporarily store the results of data source queries and serve cached responses to similar requests.

### backend

The caching backend to use when storing cached queries. Options: `memory`, `redis`, and `memcached`.

The default is `memory`.

### enabled

Setting 'enabled' to `true` allows users to configure query caching for data sources.

This value is `true` by default.

{{% admonition type="note" %}}
This setting enables the caching feature, but it does not turn on query caching for any data source. To turn on query caching for a data source, update the setting on the data source configuration page. For more information, refer to the [query caching docs]({{< relref "../../../administration/data-source-management#enable-and-configure-query-caching" >}}).
{{% /admonition %}}

### ttl

_Time to live_ (TTL) is the time that a query result is stored in the caching system before it is deleted or refreshed. This setting defines the time to live for query caching, when TTL is not configured in data source settings. The default value is `1m` (1 minute).

### max_ttl

The max duration that a query result is stored in the caching system before it is deleted or refreshed. This value will override `ttl` config option or data source setting if the `ttl` value is greater than `max_ttl`. To disable this constraint, set this value to `0s`.

The default is `0s` (disabled).

{{% admonition type="note" %}}
Disabling this constraint is not recommended in production environments.
{{% /admonition %}}

### max_value_mb

This value limits the size of a single cache value. If a cache value (or query result) exceeds this size, then it is not cached. To disable this limit, set this value to `0`.

The default is `1`.

### connection_timeout

This setting defines the duration to wait for a connection to the caching backend.

The default is `5s`.

### read_timeout

This setting defines the duration to wait for the caching backend to return a cached result. To disable this timeout, set this value to `0s`.

The default is `0s` (disabled).

{{% admonition type="note" %}}
Disabling this timeout is not recommended in production environments.
{{% /admonition %}}

### write_timeout

This setting defines the number of seconds to wait for the caching backend to store a result. To disable this timeout, set this value to `0s`.

The default is `0s` (disabled).

{{% admonition type="note" %}}
Disabling this timeout is not recommended in production environments.
{{% /admonition %}}

## [caching.encryption]

### enabled

When 'enabled' is `true`, query values in the cache are encrypted.

The default is `false`.

### encryption_key

A string used to generate a key for encrypting the cache. For the encrypted cache data to persist between Grafana restarts, you must specify this key. If it is empty when encryption is enabled, then the key is automatically generated on startup, and the cache clears upon restarts.

The default is `""`.

## [caching.memory]

### gc_interval

When storing cache data in-memory, this setting defines how often a background process cleans up stale data from the in-memory cache. More frequent "garbage collection" can keep memory usage from climbing but will increase CPU usage.

The default is `1m`.

### max_size_mb

The maximum size of the in-memory cache in megabytes. Once this size is reached, new cache items are rejected. For more flexible control over cache eviction policies and size, use the Redis or Memcached backend.

To disable the maximum, set this value to `0`.

The default is `25`.

{{% admonition type="note" %}}
Disabling the maximum is not recommended in production environments.
{{% /admonition %}}

## [caching.redis]

### url

The full Redis URL of your Redis server. For example: `redis://username:password@localhost:6379`. To enable TLS, use the `redis` scheme.

The default is `"redis://localhost:6379"`.

### cluster

A comma-separated list of Redis cluster members, either in `host:port` format or using the full Redis URLs (`redis://username:password@localhost:6379`). For example, `localhost:7000, localhost: 7001, localhost:7002`.
If you use the full Redis URLs, then you can specify the scheme, username, and password only once. For example, `redis://username:password@localhost:0000,localhost:1111,localhost:2222`. You cannot specify a different username and password for each URL.

{{% admonition type="note" %}}
If you have specify `cluster`, the value for `url` is ignored.
{{% /admonition %}}

{{% admonition type="note" %}}
You can enable TLS for cluster mode using the `redis` scheme in Grafana Enterprise v8.5 and later versions.
{{% /admonition %}}

### prefix

A string that prefixes all Redis keys. This value must be set if using a shared database in Redis. If `prefix` is empty, then one will not be used.

The default is `"grafana"`.

## [caching.memcached]

### servers

A space-separated list of memcached servers. Example: `memcached-server-1:11211 memcached-server-2:11212 memcached-server-3:11211`. Or if there's only one server: `memcached-server:11211`.

The default is `"localhost:11211"`.

## [recorded_queries]

### enabled

Whether the recorded queries feature is enabled

### min_interval

Sets the minimum interval to enforce between query evaluations. The default value is `10s`. Query evaluation will be
adjusted if they are less than this value. Higher values can help with resource management.

The interval string is a possibly signed sequence of decimal numbers, followed by a unit suffix (ms, s, m, h, d), e.g.
30s or 1m.

### max_queries

The maximum number of recorded queries that can exist.

### default_remote_write_datasource_uid

The UID of the datasource where the query data will be written.

If all `default_remote_write_*` properties are set, this information will be populated at startup. If a remote write target has
already been configured, nothing will happen.

### default_remote_write_path

The api path where metrics will be written

If all `default_remote_write_*` properties are set, this information will be populated at startup. If a remote write target has
already been configured, nothing will happen.

### default_remote_write_datasource_org_id

The org id of the datasource where the query data will be written.

If all `default_remote_write_*` properties are set, this information will be populated at startup. If a remote write target has
already been configured, nothing will happen.
