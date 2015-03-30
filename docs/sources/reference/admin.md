----
page_title: Grafana Admin
page_description: Grafana Admin guide
page_keywords: grafana, admin, administration, documentation
---

Grafana has two levels of administrators:

* Organizational administrators: These admins can manage users within specific organizations in a particular Grafana installation
* Grafana administrators: These super admins can manage users across all organizations in a Grafana installation. They can also change and access system-wide settings.

# Organizational Administrators

Note: If Grafana is configured with users.allow_org_create = true, any User of any Organization will be able to start their own Organization and become the administrator of that Organization.

As an Organizational administrator, you can manage all Users within your Organization. 

# Grafana Administrators

As a Grafana Administrator, you have complete access to any Organization or User in that instance of Grafana. 

When performing actions as a Grafana admin, the sidebar will change it's apperance as below to indicate you are performing global server administration.

[screenshot]

From the Grafana Server Admin page, you can access the System Info page which summarizes all of the backend configuration settings of the Grafana server.

# Why would I have multiple Organizations?

In many cases, a Grafana installation will only have one Organization. There's no need to create multiple Organizations if you want all your users to have access to the same set of dashboards and data. In a multitenant deployment, Organizations can be used to provide a full Grafana experience to different sets of users from a single Grafana instance, at the convenience of the Grafana Administrator. 
