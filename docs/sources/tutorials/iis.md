+++
title = "Grafana with IIS Reverse Proxy on Windows"
type = "docs"
keywords = ["grafana", "tutorials", "proxy", "IIS", "windows"]
[menu.docs]
parent = "tutorials"
weight = 10
+++

# How to Use IIS with URL Rewrite as a Reverse Proxy for Grafana on Windows

If you want Grafana to be a subpath or subfolder under a website in IIS then the URL Rewrite module for ISS can be used to support this.

Example:

- Parent site: http://localhost:8080
- Grafana: http://localhost:3000

Grafana as a subpath: http://localhost:8080/grafana

## Setup

If you have not already done it, then a requirement is to install URL Rewrite module for IIS.

Download and install the URL Rewrite module for IIS: https://www.iis.net/downloads/microsoft/url-rewrite

## Grafana Config

The Grafana config can be set by creating a file named `custom.ini` in the `conf` subdirectory of your Grafana installation. See the [installation instructions](http://docs.grafana.org/installation/windows/#configure) for more details.

Given that the subpath should be `grafana` and the parent site is `localhost:8080` then add this to the `custom.ini` config file:

 ```bash
[server]
domain = localhost:8080
root_url = %(protocol)s://%(domain)s/grafana/
```

Restart the Grafana server after changing the config file.

## IIS Config

1. Open the IIS Manager and click on the parent website
2. In the admin console for this website, double click on the Url Rewrite option:
    {{< docs-imagebox img="/img/docs/tutorials/IIS_admin_console.png"  max-width= "800px" >}}

3. Click on the `Add Rule(s)...` action
4. Choose the Blank Rule template for an Inbound Rule
    {{< docs-imagebox img="/img/docs/tutorials/IIS_add_inbound_rule.png"  max-width= "800px" >}}

5. Create an Inbound Rule for the parent website (localhost:8080 in this example) with the following settings:
  - pattern: `grafana(/)?(.*)`
  - check the `Ignore case` checkbox
  - rewrite url set to `http://localhost:3000/{R:2}`
  - check the `Append query string` checkbox
  - check the `Stop processing of subsequent rules` checkbox

    {{< docs-imagebox img="/img/docs/tutorials/IIS_url_rewrite.png"  max-width= "800px" >}}

Finally, navigate to `http://localhost:8080/grafana` (replace `http://localhost:8080` with your parent domain) and you should come to the Grafana login page.

## Troubleshooting

### 404 error

When navigating to the grafana url (`http://localhost:8080/grafana` in the example above) and a `HTTP Error 404.0 - Not Found` error is returned then either:

- the pattern for the Inbound Rule is incorrect. Edit the rule, click on the `Test pattern...` button, test the part of the url after `http://localhost:8080/` and make sure it matches. For `grafana/login` the test should return 3 capture groups: {R:0}: `grafana` {R:1}: `/` and {R:2}: `login`.
- The `root_url` setting in the Grafana config file does not match the parent url with subpath.

### Grafana Website only shows text with no images or css

{{< docs-imagebox img="/img/docs/tutorials/IIS_proxy_error.png"  max-width= "800px" >}}

1. The `root_url` setting in the Grafana config file does not match the parent url with subpath. This could happen if the root_url is commented out by mistake (`;` is used for commenting out a line in .ini files):

    `; root_url = %(protocol)s://%(domain)s/grafana/`

2. or if the subpath in the `root_url` setting does not match the subpath used in the pattern in the Inbound Rule in IIS:

    `root_url = %(protocol)s://%(domain)s/grafana/`

    pattern in Inbound Rule: `wrongsubpath(/)?(.*)`

3. or if the Rewrite Url in the Inbound Rule is incorrect. 

    The Rewrite Url should not include the subpath. 

    The Rewrite Url should contain the capture group from the pattern matching that returns the part of the url after the subpath. The pattern used above returns 3 capture groups and the third one {R:2} returns the part of the url after `http://localhost:8080/grafana/`.
