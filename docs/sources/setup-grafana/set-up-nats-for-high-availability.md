---
description: Learn how to run the embedded NATS message bus in a Grafana high availability cluster, so instances notify each other of storage changes instead of polling the database.
keywords:
  - grafana
  - HA
  - high availability
  - NATS
  - unified storage
  - watch
labels:
  products:
    - enterprise
    - oss
menuTitle: Set up NATS for HA
title: Set up NATS for high availability
weight: 950
---

# Set up NATS for high availability

In a high availability (HA) setup, every Grafana instance must learn about the changes that the other instances write to the shared database.
By default, each instance polls the database for these changes several times per second, and each part of Grafana that watches for changes runs its own poller.
On large clusters, this polling becomes a significant share of the database load.

Grafana can instead run an embedded NATS message bus inside each Grafana process.
The instances connect to each other, and every instance announces its writes on the bus, so the others no longer poll the database to find them.

This page explains how to turn on embedded NATS in an HA cluster, how to protect the traffic between instances, which network ports to open, and what changes in Grafana.

{{< admonition type="note" >}}
Embedded NATS is available in Grafana 13.4 and later behind the `[nats]` settings on this page.
It's off by default.
Test it on a non-production cluster before you turn it on in production.
{{< /admonition >}}

## Before you begin

Before you turn on embedded NATS, ensure you have the following:

- **An HA cluster:** Two or more Grafana instances that share a MySQL or PostgreSQL database, as described in [Set up Grafana for high availability](../set-up-for-high-availability/).
- **The same Grafana version everywhere:** Every instance runs Grafana 13.4 or later.
  An instance that doesn't run embedded NATS doesn't announce its writes on the bus.
- **Network access between instances:** Every instance can reach every other instance on TCP port `6222`.
  Refer to [Open the cluster port between instances](#open-the-cluster-port-between-instances).

## How embedded NATS works

With embedded NATS turned on, the instances of a cluster form a NATS cluster among themselves.
You don't run or upgrade a separate NATS server.

- **Automatic discovery:** Instances find each other through the shared database, so you don't configure a list of peers or a seed address.
- **Routes between instances:** Each instance connects to every peer on the cluster port, `6222` by default.
  A single instance on SQLite doesn't open the cluster port.
- **Shared, encrypted route credential:** Grafana creates a random route credential and stores it encrypted with Secrets Manager, like other Grafana secrets.
  The cluster port rejects routes without it, so every instance must use the same `[secrets_manager]` encryption provider and keys.
- **In-process clients only:** Grafana connects to its own embedded server inside the process, so the client port, `4222`, stays closed.
- **Notifications:** After each committed write, the instance that wrote it publishes a notification with the metadata that other instances need, such as the resource key and version.

## What changes when you turn on NATS

Parts of Grafana that watch for changes to resources, such as dashboards and folders, learn about them from the bus instead of polling the database.
This covers the watch API clients, and other consumers such as Git Sync.

- **No database polling for watches:** Each consumer subscribes to the bus and only reads the rows that notifications point to.
  With `enabled = false` or `notifier = false`, watches poll the database as before.
- **Expired watches instead of missed events:** NATS delivers each notification at most once.
  When Grafana detects a gap, or a client resumes a watch from a point that the bus can't cover, Grafana ends the watch with an `Expired` error (HTTP status `410`), and the client lists again.

## Turn on embedded NATS

Add the following configuration to the configuration file of every instance, or set the `GF_NATS_ENABLED=true` environment variable:

```ini
[nats]
enabled = true
```

With only this setting, each instance joins the other instances that share its database and serves unified storage watches from the bus instead of polling the database.
The cluster port listens on all interfaces, and each instance advertises an address that Grafana detects, as described in [Choose the address that peers connect to](#choose-the-address-that-peers-connect-to).

Open the cluster port between the instances, as described in [Open the cluster port between instances](#open-the-cluster-port-between-instances).

Without cluster TLS, the route credential crosses the network in clear text, and anyone who can observe the traffic can reuse it.
Grafana logs a warning at startup in this case.
Turn on [cluster TLS](#encrypt-traffic-between-instances), or restrict the cluster port to the Grafana instances.

If you add embedded NATS to a cluster that's already running, refer to [Turn on NATS in a running cluster](#turn-on-nats-in-a-running-cluster).

For a description of every setting, refer to [`[nats]`](../configure-grafana/#nats) in the configuration reference.

## Turn on NATS in a running cluster

You can turn on embedded NATS with a single rolling restart.
During the restart, the instances that already serve watches from the bus don't see the writes of the instances that don't publish to the bus yet.
Their watch clients see the missed writes when they list again, at the latest after `notifier_watch_max_age` (`1h` by default).

To avoid this gap, turn on embedded NATS in two rounds of restarts:

1. On every instance, set `enabled = true` together with `notifier = false`.
   Restart the instances one at a time.
   The instances publish their writes and form the NATS cluster, but watches still poll the database.
1. Check that `grafana_nats_embedded_server_routes` is the number of instances minus one on every instance, as described in [Check the NATS cluster](#check-the-nats-cluster).
1. On every instance, remove `notifier = false`.
   Restart the instances one at a time.

Instances with and without cluster TLS can't connect to each other.
To turn on cluster TLS in a cluster that already serves watches from the bus, use three rounds of restarts, one instance at a time:

1. On every instance, set `notifier = false` without changing the TLS settings, so that watches poll the database.
1. On every instance, configure cluster TLS, as described in [Encrypt traffic between instances](#encrypt-traffic-between-instances).
1. Check that `grafana_nats_embedded_server_routes` is the number of instances minus one on every instance, then remove `notifier = false` on every instance.

To go back to polling the database, set `notifier = false` and restart the instances.

## Choose the address that peers connect to

Each instance advertises the host that its peers dial to reach its cluster port.
Grafana picks the host in this order:

1. **`advertise_address`:** If set, Grafana advertises this host name or IP address.
   Don't include a port, because Grafana always advertises `cluster_port`.
1. **A specific `listen_address`:** If `listen_address` is a specific address, such as `10.0.1.11`, Grafana advertises it.
1. **A detected address:** If the cluster port listens on a wildcard address, such as the default `0.0.0.0`, Grafana advertises the first IPv4 address of a network interface that's up and isn't a loopback interface.
   Grafana logs the detected address at startup.

With the defaults, every instance can use the same configuration file.
In a container or a Kubernetes Pod, the detected address is the address of the container's network interface.

Set `advertise_address` on each instance when the detected address is wrong, for example when a host has several network interfaces, when the instances reach each other through network address translation, or when the instances use IPv6.

## Encrypt traffic between instances

By default, the connections between instances on the cluster port are authenticated with the route credential, but they aren't encrypted.
To encrypt them, set up mutual TLS: every instance presents a certificate signed by your certificate authority (CA), and verifies the certificate of each peer against the same CA.

```ini
[nats]
cluster_tls_cert_path = /etc/grafana/nats/tls.crt
cluster_tls_key_path = /etc/grafana/nats/tls.key
cluster_tls_ca_path = /etc/grafana/nats/ca.crt
```

The settings do the following:

- **`cluster_tls_cert_path`:** The PEM-encoded certificate this instance presents to its peers.
- **`cluster_tls_key_path`:** The PEM-encoded private key for the certificate, without a passphrase.
- **`cluster_tls_ca_path`:** The PEM-encoded CA certificates that peer certificates must be signed by.
  The file can contain several CA certificates.

Set all three settings together.
If you set only some of them, or Grafana can't read or load the files, Grafana fails to start with an error.
With cluster TLS on, each instance advertises a `tls://` route to its peers, and the route credential only crosses the network inside TLS.

Every instance in a cluster must use the same mode.
Instances with cluster TLS and instances without it can't connect to each other.
To turn on cluster TLS for a cluster that already serves watches from the bus, follow [Turn on NATS in a running cluster](#turn-on-nats-in-a-running-cluster).

### Certificate requirements

Each instance's certificate must meet the following requirements:

- **Signed by your CA:** The CA in `cluster_tls_ca_path` on every instance must verify the certificate.
- **Server and client use:** The certificate must allow both server and client authentication, with the `serverAuth` and `clientAuth` extended key usages.
  Each instance accepts connections from its peers and also dials them.
- **Matching names:** The certificate's subject alternative names (SANs) must match the host this instance advertises to its peers.
  Use a DNS SAN for a host name, and an IP SAN for an IP address, including an address that Grafana detects.
- **TLS 1.2 or later:** Grafana doesn't accept older TLS versions on the cluster port.

If instance IP addresses change, for example when containers restart or virtual machines in a scale set or an autoscaling group are replaced, set `advertise_address` to a DNS name that resolves to each instance and issue the certificates for those names.

You can give every instance its own certificate, or share one certificate whose SANs cover the names of all instances, for example a wildcard DNS SAN such as `*.grafana.example.internal`.
On virtual machines, the agent of your secret store or certificate service can write the certificate files to each machine and replace them when it rotates them, and Grafana loads the new files without a restart.

The following commands show one way to create a CA and a certificate for one instance with OpenSSL.
Use your organization's certificate tooling for production certificates.

```sh
openssl req -x509 -newkey rsa:4096 -nodes -days 3650 \
  -subj "/CN=Grafana NATS CA" -keyout ca.key -out ca.crt

openssl req -newkey rsa:2048 -nodes \
  -subj "/CN=<INSTANCE_NAME>" -keyout tls.key -out tls.csr

cat > tls.ext <<EOF
subjectAltName = DNS:<INSTANCE_DNS_NAME>, IP:<INSTANCE_IP>
extendedKeyUsage = serverAuth, clientAuth
EOF

openssl x509 -req -in tls.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -days 365 -extfile tls.ext -out tls.crt
```

Replace the following placeholders:

- _`<INSTANCE_NAME>`_: A name for the instance, for example `grafana-1`.
- _`<INSTANCE_DNS_NAME>`_: The host name the instance advertises, for example `grafana-1.example.internal`.
  Remove the `DNS:` entry if the instance advertises an IP address.
- _`<INSTANCE_IP>`_: The IP address the instance advertises, for example `10.0.1.11`.
  Remove the `IP:` entry if the instance advertises a host name.

Copy `ca.crt`, `tls.crt`, and `tls.key` to the instance.
Keep `ca.key` out of the Grafana hosts.

### Rotate certificates

Grafana checks the three certificate files every 15 seconds and loads them again when they change, so you don't need to restart Grafana.
New connections between instances use the new certificates, and established connections keep their TLS session.
Grafana logs `reloaded nats cluster tls certificates` after each reload.

If the new files can't be read or don't form a valid certificate, key, and CA, Grafana logs an error and keeps the current certificates.
This happens, for example, when the certificate and the key don't match because only one of them was replaced so far.
Grafana tries again after the files change.

To replace the CA without breaking connections, rotate in three steps:

1. Append the new CA certificate to `cluster_tls_ca_path` on every instance, so that the file contains both CA certificates.
1. Replace the certificate and key on every instance with ones signed by the new CA.
1. Remove the old CA certificate from `cluster_tls_ca_path` on every instance.

Wait until every instance has reloaded its files before you start the next step.

## Rotate the route credential

To replace the route credential, delete its row from the database and restart all instances:

```sql
DELETE FROM secret_encrypted_value WHERE namespace = 'default' AND name = 'nats:grafana.route-credential';
```

The first instance that starts creates a new credential, and the other instances read it when they start.
Restart the instances in quick succession, because instances with the old and the new credential can't connect to each other.

You don't need to replace the credential when you rotate the Secrets Manager encryption keys, because Secrets Manager re-encrypts it together with your other secrets.

## Open the cluster port between instances

The instances connect to each other on `cluster_port`, TCP port `6222` by default.
Allow inbound TCP traffic on this port from the other Grafana instances only.
Don't expose the port through your load balancer or to the internet.
Without cluster TLS, restricting the port is what keeps the route credential away from other hosts.

The client port, `4222`, doesn't need to be open, because Grafana connects to its embedded server inside the process.

How you open the port depends on where the instances run:

- **AWS:** Add an inbound rule to the security group of the Grafana instances that allows TCP port `6222` from the same security group.
- **Azure:** Add an inbound security rule to the network security group (NSG) of the Grafana instances that allows TCP port `6222` from the subnet or the application security group of the Grafana instances.
- **Kubernetes:** If you use network policies, allow TCP port `6222` between the Grafana Pods.
  In the Grafana Helm chart, the `networkPolicy.natsCluster.enabled` option opens the cluster port between the Grafana Pods of the release, and it's on by default when `networkPolicy.enabled` is `true`.
  The port follows `[nats] cluster_port` in `grafana.ini`, then `6222`; set `networkPolicy.natsCluster.port` to override it.
- **Host firewalls:** Allow inbound TCP port `6222` from the addresses of the other Grafana instances.

If the instances already connect to each other for alerting high availability, which uses port `9094` by default, open `6222` with the same kind of rule.

## Check the NATS cluster

To check that the cluster is fully connected, look at the following metrics on every instance:

- **`grafana_nats_embedded_server_up`:** `1` while the embedded server runs.
- **`grafana_nats_embedded_server_routes`:** The number of other instances that the embedded server is connected to.
  In a fully connected cluster, it's the number of instances minus one.
- **`grafana_nats_publisher_connection_status` and `grafana_nats_subscriber_connection_status`:** `1` while Grafana is connected to the bus.

The following metrics count notifications that didn't reach the watches, and should stay at `0`:

- **`grafana_nats_publisher_publish_errors_total`:** Notifications that Grafana failed to publish.
- **`grafana_storage_server_nats_notifier_dropped_events_total`:** Notifications dropped before delivery, by `reason`.
- **`grafana_storage_server_sql_watch_missing_events_total`:** Writes that the SQL backend couldn't deliver to watches, by `reason`.
  Each one expires the open watches.

## Troubleshoot embedded NATS

The following sections describe common problems and the log messages that point to them.
The embedded NATS server reports its own warnings and errors, such as failed TLS handshakes or rejected routes, with the `infra.nats.server` logger.

### An instance doesn't connect to its peers

If `grafana_nats_embedded_server_routes` is lower than the number of instances minus one, check the following:

- **The cluster port:** Errors such as `Error trying to connect to route` mean that the peer's cluster port isn't reachable.
  Refer to [Open the cluster port between instances](#open-the-cluster-port-between-instances).
- **The advertised address:** `embedded nats advertising a loopback route url` means that instances on other hosts can't reach this instance.
  Set `listen_address` or `advertise_address`, as described in [Choose the address that peers connect to](#choose-the-address-that-peers-connect-to).
- **Cluster TLS:** TLS handshake errors mean that the certificates don't meet the [certificate requirements](#certificate-requirements), or that only some instances use cluster TLS.
- **The database:** `started embedded nats server without clustering` means that the instance doesn't open the cluster port, because it uses SQLite or discovery is turned off.
  Use MySQL or PostgreSQL for high availability.

### Clustering waits for the route credential

- **`nats cluster routes wait for the route credential, but the stored credential cannot be decrypted`:** This instance uses a different `[secrets_manager]` encryption provider or keys than the instance that created the credential.
  Configure the same encryption provider and keys on every instance.
  Delete the credential, as described in [Rotate the route credential](#rotate-the-route-credential), only once Secrets Manager can encrypt new secrets on every instance, because otherwise Grafana can't create a new one either.
- **`nats cluster routes wait for the route credential`:** Grafana couldn't read or create the route credential at startup, for example because the database wasn't reachable.
  Grafana retries in the background and logs `nats clustering enabled: the route credential is loaded` when it succeeds.

### A setting has no effect

- **`Watch setting has no effect`:** You set `notifier` or `notifier_watch_max_age`, but the running storage backend ignores it, for example because `enabled = false`.
  The message names the setting and the reason.
- **`tls_*` settings ignored:** In embedded mode, Grafana logs a warning that the `tls_*` settings are ignored, because they only apply to an external NATS server.
  To encrypt traffic between instances, use the `cluster_tls_*` settings.

### The route credential crosses the network in clear text

`nats cluster port listens beyond loopback without cluster TLS` means that the cluster port is reachable from other hosts without cluster TLS.
Turn on [cluster TLS](#encrypt-traffic-between-instances) or restrict the cluster port to the Grafana instances.

### Inspect the embedded server

To inspect the embedded server with the `nats` command-line tool, set `client_listen = true`.
It opens `client_port` (`4222`) on `client_listen_address` (`127.0.0.1`) with no TLS or authentication, so keep it on loopback and turn it off afterwards.

## Use your own NATS server

If you already run a NATS server, you can connect Grafana to that server instead of running the embedded one.
Set `mode = external` and list the server URLs in `client_urls`.
The `cluster_*`, `listen_address`, and `advertise_address` settings don't apply in this mode.

Use the `auth_mode` setting to choose how Grafana authenticates to your NATS server:

- **`token`:** Grafana presents the value of `token`.
- **`credentials`:** Grafana presents a NATS credentials file (`.creds`) that contains a user JWT and its seed.
  Set `credentials_file`, or set `publisher_credentials_file` and `subscriber_credentials_file` to give publishing and subscribing different identities.

Use the `tls_*` settings to encrypt and verify the connection to your NATS server.
The following example connects to an external NATS cluster over TLS with a token:

```ini
[nats]
enabled = true
mode = external
client_urls = tls://<NATS_HOST_1>:4222,tls://<NATS_HOST_2>:4222
auth_mode = token
token = $__file{/etc/grafana/nats/token}
tls_enabled = true
tls_ca_cert_path = /etc/grafana/nats/ca.crt
```

Replace _`<NATS_HOST_1>`_ and _`<NATS_HOST_2>`_ with the host names of your NATS servers.
The `$__file{}` syntax reads the token from a file, so it doesn't appear in the configuration file.
For more information, refer to [Variable expansion](../configure-grafana/#variable-expansion).

## Next steps

To learn more about running Grafana in a cluster, refer to the following resources:

- [Set up Grafana for high availability](../set-up-for-high-availability/)
- [`[nats]` configuration reference](../configure-grafana/#nats)
- [Configure Grafana](../configure-grafana/)
