+++
title = "Hosted Grafana"

[menu.grafana-cloud]
identifier = "hosted-grafana"
weight = 2
+++

# Hosted Grafana


## Customizations

> Customizing Hosted Grafana is available for customers of Grafana Cloud Standard plan
> ([pricing information](https://grafana.com/cloud#pricing))

To customize any aspect of your Hosted Grafana instance, send a support request to
[support@grafana.com](mailto:support@grafana.com)
from the email address associated with your grafana.com account.


### Custom domain

1. Create a CNAME record in the DNS pointing to his instance URL.  
   Example: `grafana.example.com. IN CNAME foonettech.grafana.net.`
2. Open a support request to configure the ingress endpoint on our end.


### Custom logo, favicon and title

Send us a support request with images in attachments.
The logo must be an SVG file and the favicon must be PNG.


### Enabling the login form

{{< imgbox img="hosted-grafana-login-form.png" max-width="40%" caption="Hosted Grafana login form" >}}

If enabled, the login form is visible on the login page.
It allows users to authenticate with the local database (internal to Grafana) or LDAP.

The default is disabled.
Users login with their grafana.com account.
They must be a member of the Organisation

Equivalent Grafana configuration: [disable\_login\_form](../../grafana/latest/auth/overview/#disable-login-form)

<div class="clearfix"></div>


### Enabling anonymous login

* Both anonymous login and OAuth can be enabled at the same time, they don't interfere.
* Anyone from the Internet will be able to view your dashboards.
* To login, just need to navigate to the `/login` path, because there will no longer be an automatic redirect from `/` to `/login`.

Equivalent Grafana configuration: [anonymous\_authentication](../../grafana/latest/auth/overview/#anonymous-authentication)

See also: [Dashboard features > Sharing](../../grafana/latest/reference/sharing/)


### Adding an OAuth2 provider

Send us the OAuth configuration parameters. We will provision them in your Hosted Grafana instance.

See also: [OAuth integrations](../../grafana/latest/auth/overview/#oauth-integrations)

You may have more than one OAuth provider. Optionally, we can disable `auth.grafananet` authentication.


### Adding an LDAP configuration

Send us your `ldap.toml` file. We will provision it in your Hosted Grafana instance.

See also: [LDAP configuration](../../grafana/latest/auth/ldap/#grafana-ldap-configuration)


## Common questions and issues


### About the admin user

On a self-hosted instance of Grafana, you have an `admin` user.

This is not available on Hosted Grafana. This user is not counted against your user quota.

See also: [Grafana Admin](../../grafana/latest/permissions/overview/#grafana-admin)


### Automatically provisioned datasources randomly breaking

It is common for Hosted Metrics datasources to be automatically provisioned on a Hosted Grafana instance.
If the API key or other configuration parameter is modified subsequently,
the provisioning mechanism will overwrite changes on the next instance restart.

If this happens, open a support request to delete the provisioning files.

For details about this mechanism, see also:
[Datasources provisioning](../..http://localhost:8000/grafana/latest/administration/provisioning/#datasources)


### Source IPs for whitelisting

If your corporate network requires external services to be on a whitelist to allow access,
you can use the following lists to update your ACLs.

* JSON format: https://grafana.com/api/hosted-grafana/source-ips
* Text format: https://grafana.com/api/hosted-grafana/source-ips.txt
* DNS lookup: `src-ips.hosted-grafana.grafana.net`

Those lists are always updated with IP addresses of the nodes on our clusters
that might be running Hosted Grafana instances.
