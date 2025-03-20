---
Feedback Link: https://github.com/grafana/tutorials/issues/new
aliases:
  - /docs/grafana/latest/tutorials/iis/
authors:
  - grafana_labs
categories:
  - administration
description: Learn how to set up Grafana behind IIS with URL Rewrite.
id: iis
labels:
  products:
    - enterprise
    - oss
status: Published
summary: Learn how to set up Grafana behind IIS with URL Rewrite.
tags:
  - advanced
title: Use IIS with URL Rewrite as a reverse proxy
---

# Use IIS with URL Rewrite as a reverse proxy

If you want Grafana to be a subpath/subfolder under a website in IIS then the Application Request Routing (ARR) and URL Rewrite modules for ISS can be used to support this.

Example:

- Parent site: http://yourdomain.com:8080
- Grafana: http://localhost:3000

Grafana as a subpath: http://yourdomain.com:8080/grafana

Other Examples:

- If the application is only served on the local server, the parent site can also look like http://localhost:8080.
- If your domain is served using https on port 443, and thus the port is not normally entered in the address of your site, then the need to specify a port for the parent site in the configuration steps below can be eliminated.

## Setup

Install the URL Rewrite module for IIS.

- Download and install the URL Rewrite module for IIS: https://www.iis.net/downloads/microsoft/url-rewrite

You will also need the Application Request Routing (ARR) module for IIS for proxy forwarding

- Download and install ARR module for IIS: https://www.iis.net/downloads/microsoft/application-request-routing

## Grafana Config

The Grafana config can be set by creating a file named/editing the existing file named `custom.ini` in the `conf` subdirectory of your Grafana installation. See the [installation instructions](/docs/grafana/<GRAFANA_VERSION>/installation/windows/#configure) for more details.

Using the example from above, if the subpath is `grafana` (you can set this to whatever is required) and the parent site is `yourdomain.com:8080`, then you would add this to the `custom.ini` config file:

```bash
[server]
domain = yourdomain.com:8080
root_url = %(protocol)s://%(domain)s/grafana/
```

Restart the Grafana server after changing the config file.

Configured address to serve Grafana: http://yourdomain.com:8080/grafana

---

If you already have a subpath on your domain, configure it as follows:

- Your Parent Site Address: http://yourdomain.com/existingsubpath

```bash
[server]
domain = yourdomain.com/existingsubpath
root_url = %(protocol)s://%(domain)s/grafana/
```

Restart the Grafana server after changing the config file.

Configured address to serve Grafana: http://yourdomain.com/existingsubpath/grafana

## IIS Config

### Step 1: Forward Proxy

1. Open the IIS Manager and click on the server
2. In the admin console for the server, double click on the Application Request Routing option:
3. Click the `Server Proxy Settings` action on the right-hand pane
4. Select the `Enable proxy` checkbox so that it is enabled
5. Click `Apply` and proceed with the URL Rewriting configuration

**Note:** If you don't enable the Forward Proxy, you will most likely get 404 Not Found if you only apply the URL Rewrite rule

### Step 2: URL Rewriting

1. In the IIS Manager, click on the website that grafana will run under. For example, select the website that is bound to the http://yourdomain.com domain.
2. In the admin console for this website, double click on the URL Rewrite option:

{{< figure src="/static/img/docs/tutorials/IIS_admin_console.png"  max-width="800px" >}}

3. Click on the `Add Rule(s)...` action
4. Choose the Blank Rule template for an Inbound Rule

{{< figure src="/static/img/docs/tutorials/IIS_add_inbound_rule.png"  max-width="800px" >}}

5. Create an Inbound Rule for the website with the following settings:

- pattern: `grafana(/)?(.*)` (if you have customised the subpath that will be used, use that instead of `grafana`)
- check the `Ignore case` checkbox
- rewrite URL set to `http://localhost:3000/{R:2}`
- check the `Append query string` checkbox
- check the `Stop processing of subsequent rules` checkbox

{{< figure src="/static/img/docs/tutorials/IIS_url_rewrite.png"  max-width="800px" >}}

6. If your version of Grafana is greater than 8.3.5, you also need to configure the reverse proxy to preserve host headers.

- This can be achieved by configuring the IIS config file by running this in a cmd prompt
  `%windir%\system32\inetsrv\appcmd.exe set config -section:system.webServer/proxy -preserveHostHeader:true /commit:apphost`
- More information here https://github.com/grafana/grafana/issues/45261

Finally, navigate to `http://yourdomain.com:8080/grafana` and you should come to the Grafana login page.

## Troubleshooting

### 404 error

When navigating to the Grafana URL (`http://yourdomain.com:8080/grafana`) and a `HTTP Error 404.0 - Not Found` error is returned, then either:

- The pattern for the Inbound Rule is incorrect. Edit the rule, click on the `Test pattern...` button, test the part of the URL after `http://yourdomain.com:8080/` and make sure it matches. For `grafana/login` the test should return 3 capture groups: {R:0}: `grafana` {R:1}: `/` and {R:2}: `login`.
- The `root_url` setting in the Grafana config file does not match the parent URL with subpath.

### Grafana Website only shows text with no images or css

{{< figure src="/static/img/docs/tutorials/IIS_proxy_error.png"  max-width="800px" >}}

1. The `root_url` setting in the Grafana config file does not match the parent URL with subpath. This could happen if the root_url is commented out by mistake (`;` is used for commenting out a line in .ini files):

   `; root_url = %(protocol)s://%(domain)s/grafana/`

2. or if the subpath in the `root_url` setting does not match the subpath used in the pattern in the Inbound Rule in IIS:

   `root_url = %(protocol)s://%(domain)s/grafana/`

   pattern in Inbound Rule: `wrongsubpath(/)?(.*)`

3. or if the Rewrite URL in the Inbound Rule is incorrect.

   The Rewrite URL should not include the subpath.

   The Rewrite URL should contain the capture group from the pattern matching that returns the part of the URL after the subpath. The pattern used above returns three capture groups and the third one {R:2} returns the part of the URL after `http://yourdomain.com:8080/grafana/`.

### You see an 'Error updating options: origin not allowed' error

- Ensure you have undertaken step 6 above, to configure IIS to preserve host headers by edit IIS config by running this in cmd prompt:
  `%windir%\system32\inetsrv\appcmd.exe set config -section:system.webServer/proxy -preserveHostHeader:true /commit:apphost`
