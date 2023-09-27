

# Activate an Enterprise license

Follow these steps to activate your Grafana Enterprise license:

## Step 1. Download your license file

To download your Grafana Enterprise license, log in to your [Grafana Cloud Account](https://grafana.com) and go to your **Org Profile**. In the side menu there is a section for Grafana Enterprise licenses. At the bottom of the license details page there is **Download Token** link that will download the license.jwt file containing your license.

## Step 2. Add your license file to a Grafana instance

There are two different ways to add the license file to a Grafana instance:

- Option 1: Upload the license file through the Grafana Server Administrator page

  1. Sign in as a Grafana server admin.
  1. Navigate to **Server Admin > Upgrade** within Grafana. 
  1. Click **Upload license token file**.
  1. Select your license file, and upload it.

- Option 2: Place the *license.jwt* file in Grafana's data folder.

  This is usually located at `/var/lib/grafana` on Linux systems.

  You can also configure a custom location for the license file using the grafana.ini setting:

  ```bash
  [enterprise]
  license_path = /company/secrets/license.jwt
  ```

  This setting can also be set with an environment variable, which is useful if you're running Grafana with Docker and have a custom volume where you have placed the license file. In this case, set the environment variable `GF_ENTERPRISE_LICENSE_PATH` to point to the location of your license file.

## Step 3. Ensure that the license file's root url matches the root_url configuration option

Update the [`root_url`]({{< relref "../administration/configuration/#root-url" >}}) in your configuration. It should be the URL that users type in their browsers to access the frontend, not the node hostname(s).

This is important, because as part of the validation checks at startup, Grafana compares the license URL to the [`root_url`]({{< relref "../administration/configuration/#root-url" >}}) in your configuration.

In your configuration file:

```
[server]
root_url = https://grafana.blah.com/
```

Or with an environment variable:

```
GF_SERVER_ROOT_URL=https://grafana.blah.com/
```
