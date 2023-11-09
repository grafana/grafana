
## Team LBAC
<!-- Eric Leijonmarck -->
<!-- Enterprise, Cloud -->

X X, 2023

_Generally available in Grafana Cloud_

Grafana's new Team LBAC (Attribute-Based Access Control) feature for Loki is a significant enhancement that simplifies and streamlines data source access management based on team memberships. Users wanting fine grained access to data sources such as Loki with X amount of teams with different levels of access can make use of Team LDAP. 

This feature addresses a common challenge faced by Grafana users: managing multiple data source connections for different teams. Previously, you would configure one data source for each teams access level to logs. With Team LBAC, users can now configure custom headers based on team memberships, leveraging existing header-based LBAC, while also offering flexibility for other data sources and additional configurations like rate limiting.

To start using this feature, you need to enable the `teamHTTPHeaders` feature flag on your instance by asking support to setup the feature flag for you.