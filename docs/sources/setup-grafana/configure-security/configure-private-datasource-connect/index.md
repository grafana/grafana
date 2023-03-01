---
title: Configure Grafana private data source connect
weight: 200
_build:
  list: false
---

# Configure Grafana private data source connect

Private data source connect (PDC) enables you to securely connect your Grafana Cloud stack to data sources hosted on a private network.

> **Note:** Private data source connect is available as part of Grafana Cloud Pro, Advanced, and Enterprise.

> **Note:** Private data source connect is currently in private preview. Grafana Labs offers support on a best-effort basis, and breaking changes might occur prior to the feature being made generally available.

Observability data is often located within private networks such as on-premise networks and Virtual Private Clouds (VPCs) hosted by AWS, Azure, Google Cloud Platform, or other public cloud providers. For example, you might host your Splunk or Elasticsearch service on your private network, or you might want to visualize data from Amazon RDS hosted in a VPC.

By using private data source connect, you can query data that lives within your private network without opening your network to inbound traffic from Grafana Cloud. Queries and data are encrypted from the PDC agent to the user’s browser.

## Key features

Private data source connect routes queries and responses between your Grafana Cloud stack and your private data source through an agent deployed in your network.

![Private Data Source Connect diagram](/media/docs/grafana/grafana-pdc-diagram-1.png)

- The SSH client running in your network is configured with reverse dynamic forwarding* (\_the* [-R &lt;port>](https://man.openbsd.org/ssh.1#R~2) _option_).\_ In this mode, SSH acts as a [SOCKS](https://en.wikipedia.org/wiki/SOCKS) proxy and forwards connections to destinations requested by Grafana.
- You can restrict the destinations reachable by Grafana Cloud over this tunnel using the [PermitRemoteOpen](https://man.openbsd.org/ssh_config.5#PermitRemoteOpen) SSH option.
- The monitoring and supervision of the SSH tunnel are delegated to an agent running inside your private network. At any time, you can shut off the agent, which terminates the connection.
- The agent running inside your private network will be a horizontally scalable component to ensure fault-tolerance.
- Traffic is encrypted all the way from the Grafana Cloud instance to the SSH client running in your private network. If the private data source supports encryption (for example, HTTPS), traffic will be end-to-end encrypted.
- In your Grafana Cloud instance, you will be able to configure compatible datasources to route requests through the SSH tunnel. Each data source is configured using the internal DNS name (for example, mysql.your.domain:3306), as if Grafana were running directly inside the private network.

## Known limitations

The preview version of PDC has the following known limitations:

- You can connect each Grafana instance to just one private network. Once PDC is generally available, you can connect a single Grafana instance to multiple private networks (VPCs, on-premise networks, and so on).
- During early access, Grafana Labs’ engineering team will configure the connection in Grafana, and you will deploy an agent in your private network. Once PDC is generally available, you can set up and manage your own private data source connections.
- Private data source connect is available for the following data sources:
  - Elasticsearch
  - Graphite
  - Influxdb
  - Loki
  - Opentsdb
  - Parca
  - Phlare
  - Prometheus
  - Tempo
  - Jaeger
  - Zipkin

> **Note:** Because many data sources are maintained by community members, not all data sources work with private data source connect.

## Set up a private data source connection

To set up a private data source connection, deploy the Grafana PDC agent, configure which hosts and ports to allow on your network, and configure your data source with those ports.

### Before you begin

- You need the ability to deploy the PDC agent within your network. You can deploy it directly to a Linux or Windows server, or use a container management system like Docker or Kubernetes.
- Private data source connect is available in Grafana Cloud Pro, Cloud Advanced, and Cloud Enterprise.
- You need to know the local host name and port of the data source you would like to connect to, for example `loki:8080`.
- As with all data sources in Grafana, you need a set of credentials to access the data, for example, a username and password, or a token. Refer to the [documentation]({{< relref "../../../datasources/" >}}) for your data source to learn what credentials are needed.
- You need an administrator account for your Grafana Cloud organization. To learn more about Grafana Cloud permissions, refer to [Grafana Cloud user roles and permissions](/docs/grafana-cloud/authentication-and-permissions/cloud-roles/).

### Steps

To set up a private data source connection, follow these steps:

1. In a terminal, create a new folder, navigate to it, and generate an SSH key using the following command:

   ```
   $ ssh-keygen -f ${SLUG}  -N "" -t ed25519
   ```

   The flags used for ssh-keygen command mean the following:

   - -f: The file name of the key file
   - -N: The passphrase to use for the key pair, we want this empty
   - -t: The encryption algorithm.

   This command generates two files: `${SLUG}` and `${SLUG}.pub`. You will send `${SLUG}.pub` to the Grafana team in the next step.

   You can find more optional SSH flags in the [SSH documentation](https://www.man7.org/linux/man-pages/man1/ssh-keygen.1.html).

1. Open a support ticket or let your account team know that you would like to try private data source connect. In your ticket, provide the following information:

   - A list of the data sources on which you want to enable PDC.
   - The Grafana Cloud stack you want to connect to your private network.
   - The `${SLUG}.pub` file you generated in the previous step.

   Grafana Labs will send you a certificate and public CA.

1. Connect to Grafana Cloud using the ssh or the pdc agent in the same directory as your private key, and the certificate and known_hosts file Grafana Labs provided to you.

   There are three connecting options: Kubernetes, SSH, or the PDC Agent Docker image.

   - **Option 1:** Using Kubernetes

     Create a Kubernetes secret with the private key and the certificate and known_hosts file Grafana Labs provided.

     ```
     $ kubectl create secret generic -n ${NAMESPACE} grafana-pdc-agent \
     --from-file=key=./${SLUG} \
     --from-file=known_hosts=./known_hosts \
     --from-file=cert.pub=./${SLUG}-cert.pub
     ```

     Generate a Kubernetes deployment to deploy the agent.

     ```
     SLUG=${SLUG} PDC_GATEWAY=${PDC_GATEWAY}  NAMESPACE=${NAMESPACE} /bin/sh -c "$(curl -fsSL https://raw.githubusercontent.com/grafana/pdc-agent/main/production/kubernetes/install-agent.sh)"
     kubectl apply -f deployment.yaml
     ```

     The following list contains the environment variables used in the previous commands:

     - ${PDC_GATEWAY}: The URL of the private data source connect in Grafana Cloud. The Grafana team will give you this URL. The URL follows the format `grafana-private-datasource-connect-<cluster>.grafana.net`
     - ${SLUG}: The name of the stack you want to connect to your data source. For example, the stack `test.grafana.net` has the slug `test.`
     - ${NAMESPACE}: The Kubernetes namespace for the pdc-agent.

   - **Option 2:** Using SSH

     ```
     $ ssh -i ${SLUG} ${SLUG}@${PDC_GATEWAY} -p 22 -o UserKnownHostsFile=./known_hosts -o CertificateFile=${SLUG}-cert.pub -R 0 -vv
     ```

     The flags used in the ssh command are as follows:

     - -i ${SLUG}: The private key
     - -p 22: The port to connect to
     - -o [UserKnownHostsFile](https://man.openbsd.org/ssh_config.5#UserKnownHostsFile): The list of Grafana PDC servers to trust when establishing a connection for the first time
     - -o [CertificateFile](https://man.openbsd.org/ssh_config.5#CertificateFile): Your public certificate
     - -R 0: Runs ssh with remote port forwarding, which enables it to act as a socks server
     - -vv (optional): Sets the verbosity to debug2, so hostnames can be seen. It can be set to -v, if this is not desired.
     - -o [PermitRemoteOpen](https://man.openbsd.org/ssh_config.5#PermitRemoteOpen) (optional): This can be specified to restrict the destinations reachable by Grafana Cloud over this connection.

     Refer to the [OpenSSH documentation](https://linux.die.net/man/1/ssh) for a complete list of available ssh command flags.

     Additionally:

     - ${PDC_GATEWAY}: The URL of the private data source connect in Grafana Cloud. The Grafana team will give you this URL. The URL follows the format `private-datasource-connect-<cluster>.grafana.net`
     - ${SLUG}: The name of the stack you want to connect to your data source. For example, the stack `test.grafana.net` has the slug `test.`

   - **Option 3:** Using the [pdc-agent](https://github.com/grafana/pdc-agent) docker [image](https://hub.docker.com/r/grafana/pdc-agent/tags)

     ```
     docker run --rm --name pdc-agent -v $(pwd):/etc/keys grafana/pdc-agent:latest -i /etc/keys/${SLUG} ${SLUG}@${PDC_GATEWAY} -p 22 -o BatchMode=yes -o UserKnownHostsFile=/etc/keys/known_hosts -o CertificateFile=/etc/keys/${SLUG}-cert.pub -R 0 -v
     ```

     The flags used on this are a combination of:

     - –-rm: Remove the docker container when it exits
     - --name pdc-agent: This names the docker process pdc-agent
     - -v $(pwd):/etc/keys: Copies the working directory into the /etc/keys directory in the Docker container
     - -i /etc/keys/${SLUG}: The private key
     - -p 22: The port to connect to
     - -o [BatchMode](https://man.openbsd.org/ssh_config.5#BatchMode): Skips the passphrase checking
     - -o [UserKnownHostsFile](https://man.openbsd.org/ssh_config.5#UserKnownHostsFile): The list of Grafana PDC servers to trust when establishing a connection for the first time
     - -o [CertificateFile](https://man.openbsd.org/ssh_config.5#CertificateFile): Your public certificate
     - -R 0: Runs ssh with remote port forwarding (which allows it to act as a socks server)
     - -v (optional): Sets the verbosity to debug.
     - -o [PermitRemoteOpen](https://man.openbsd.org/ssh_config.5#PermitRemoteOpen) (optional): This can be specified to restrict the destinations reachable by Grafana Cloud over this connection.

1. (Optional) For high availability, you can install additional instances of the agent on your network with the same configuration.

   These can be deployed to different regions, data centers, or providers as long as they are on the same network.

## Configure a data source to use private data source connect

After you have set up a private data source connection, set up a data source in Grafana to query your data.

### Before you begin

- Ensure the data source you want to connect to supports Private data source connect. Refer to [Known limitations](#known-limitations) for a list of supported data sources.
- [Set up a private data source connection](#set-up-a-private-data-source-connection)

### Steps

1. Follow the [Add a data source]({{< relref "../../../administration/data-source-management/#add-a-data-source" >}}) instructions.

1. Enable the Secure Socks Proxy setting for your data source.

   > **Note:** If you are running Grafana v9.4.0, this setting is only available in Prometheus and Loki, but you can still enable PDC for all the data sources listed as available in this document. Reach out to the Grafana engineering team or support for assistance.

1. In the URL field for your data source, use the same URL as if you were on your private network, instead of a public URL.

1. Save, test, and query your data source as usual.

### Troubleshooting

If you have trouble connecting to your data source, check the list of destinations reachable by the PDC agent, which might be restricted using the [PermitRemoteOpen](https://man.openbsd.org/ssh_config.5#PermitRemoteOpen) SSH option. You can see this list in the agent’s configuration.

## Audit activity on the PDC agent

The PDC agent logs every connection attempt, whether it is successful or denied. You can use these logs to audit traffic and ensure that no unwanted actors are trying to query your data.

The method you use to access and store the logs depends on where the agent is deployed, and your logging tool.

The logs will be the standard debug logs from ssh, plus an introduction log when you’ve first connected to Grafana’s PDC Service.

Once connected, the log will be: \
`This is Grafana Private Datasource Connect!`

Successful logs will look like this:

```
debug1: client_input_channel_open: ctype forwarded-tcpip rchan 1 win 2097152 max 32768
debug1: client_request_forwarded_tcpip: listen localhost port 1234, originator ::1 port 61779
debug1: channel 1: new [::1]
debug1: confirm forwarded-tcpip
debug1: connect_next: host 34.205.150.168 ([34.205.150.168]:443) in progress, fd=10
debug1: channel 1: connected to 34.205.150.168 port 443
debug1: channel 1: free: ::1, nchannels 2
```

Failed connections could look like this:

> **Note:** There are different reasons that may be logged for the failed reason.

```
debug1: client_input_channel_open: ctype forwarded-tcpip rchan 1 win 2097152 max 32768
debug1: client_request_forwarded_tcpip: listen localhost port 1234, originator ::1 port 61917
debug1: channel 1: new [::1]
debug1: confirm forwarded-tcpip
debug1: rdynamic_connect_finish: requested forward not permitted
debug1: channel 1: free: ::1, nchannels 2
```
