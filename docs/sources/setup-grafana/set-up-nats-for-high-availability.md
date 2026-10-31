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

This page explains how to turn on embedded NATS in an HA cluster, how to protect the traffic between instances, which network ports to open, and what changes for unified storage.

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
- **A single Grafana process per instance:** Each instance runs the `grafana server` command.
  Embedded NATS isn't supported when you run Grafana in module mode with the `grafana server target` command.
  In module mode, connect Grafana to a NATS server that you run yourself, as described in [Use your own NATS server](#use-your-own-nats-server).

## How embedded NATS works

With embedded NATS turned on, the instances of a cluster form a NATS cluster among themselves.
You don't run or upgrade a separate NATS server.

- **Discovery through the database:** Each instance registers itself in the `nats_discovery_peers` table of the main Grafana database and refreshes its row every `discovery_interval` (default `5s`).
  Grafana creates the table on its first start.
  Instances read the table to find their peers, so you don't configure a list of peers or a seed address.
  Peers that stop refreshing their row are dropped after `discovery_ttl` (default `15s`).
  An instance that shuts down cleanly removes its row and tells its peers, so they drop it right away.
- **Routes on the cluster port:** Each instance connects to every peer on the cluster port, `6222` by default.
  On MySQL and PostgreSQL, the cluster port listens on all network interfaces, so instances on other hosts can connect.
- **Authenticated routes:** On its first start, Grafana creates a random route credential and stores it in the `nats_discovery_peers` table.
  Every instance that shares the database uses this credential, and the cluster port rejects routes without it.
  The credential isn't derived from any other secret, such as `secret_key`.
- **In-process clients only:** Grafana connects to its own embedded server inside the process.
  The embedded server doesn't open the client port, `4222`, to the network.
- **Notifications, not data:** After each committed create, update, or delete in unified storage, the instance that wrote it publishes a small notification with the resource key and resource version.
  Object bodies stay in the database.

## Turn on embedded NATS

Add the following configuration to the configuration file of every instance, or set the `GF_NATS_ENABLED=true` environment variable:

```ini
[nats]
enabled = true
```

With only this setting, Grafana does the following:

- **Starts the embedded server:** Each instance runs a NATS server and joins the other instances that share its database.
- **Publishes its writes:** Each instance publishes a notification for every unified storage write.
- **Serves watches from the bus:** Unified storage watches use the bus instead of polling the database.
- **Listens for peers:** On MySQL and PostgreSQL, the cluster port listens on all interfaces, and Grafana advertises the IPv4 address of its first network interface to its peers.
  Refer to [Choose the address that peers connect to](#choose-the-address-that-peers-connect-to).

Open the cluster port between the instances, as described in [Open the cluster port between instances](#open-the-cluster-port-between-instances).

Without cluster TLS, the route credential crosses the network in clear text, and anyone who can observe the traffic can reuse it.
Grafana logs a warning at startup in this case.
Turn on [cluster TLS](#encrypt-traffic-between-instances), or restrict the cluster port to the Grafana instances.

If you add embedded NATS to a cluster that's already running, refer to [Turn on NATS in a running cluster](#turn-on-nats-in-a-running-cluster).

### Optional settings

The following settings have defaults that suit most clusters:

- **`notifier`:** Serves unified storage watches from the bus.
  It follows `enabled` by default.
  Set it to `false` to publish notifications but keep polling the database for watches.
- **`notifier_watch_max_age`:** Ends each watch served from the bus after this duration, so that its client lists again.
  This bounds how long a lost notification can go unnoticed.
  The default is `1h` while `notifier` is on.
  Refer to [What changes for unified storage](#what-changes-for-unified-storage).
- **`listen_address`:** The address that the cluster port binds to.
  If empty, Grafana binds `0.0.0.0` on MySQL and PostgreSQL with `discovery_enabled = true`, and `127.0.0.1` otherwise.
- **`advertise_address`:** The host that other instances dial to reach this instance.
  Refer to [Choose the address that peers connect to](#choose-the-address-that-peers-connect-to).
- **`cluster_port`:** The port that instances connect to each other on.
  The default is `6222`.

If you set `notifier` or `notifier_watch_max_age` and the running storage backend ignores it, for example because `enabled = false`, Grafana logs `Watch setting has no effect` at startup with the setting and the reason.

For a description of every setting, refer to [`[nats]`](../configure-grafana/#nats) in the configuration reference.

## Turn on NATS in a running cluster

You can turn on embedded NATS with a single rolling restart.
During the restart, the instances that already serve watches from the bus don't see the writes of the instances that don't publish to the bus yet.
Their watch clients see the missed writes when they list again, at the latest after `notifier_watch_max_age` (`1h` by default).

To avoid this gap, turn on embedded NATS in two rounds of restarts:

1. On every instance, set `enabled = true` together with `notifier = false`.
   Restart the instances one at a time.
   The instances publish their writes and form the NATS cluster, but watches still poll the database.
1. Check that every instance connects to all of its peers, as described in [Monitor embedded NATS](#monitor-embedded-nats).
1. On every instance, remove `notifier = false`.
   Restart the instances one at a time.

Use the same two rounds when you turn on cluster TLS for a cluster that already serves watches from the bus, because instances with and without cluster TLS can't connect to each other.

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

If instance IP addresses change, for example when containers restart, set `advertise_address` to a DNS name that resolves to each instance and issue the certificates for those names.

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
DELETE FROM nats_discovery_peers WHERE key_path = 'nats/peers/grafana.route-credential';
```

The first instance that starts creates a new credential, and the other instances read it when they start.
Restart the instances in quick succession, because instances with the old and the new credential can't connect to each other.

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

## What changes for unified storage

Unified storage watches tell Grafana and its API clients about changes to resources, such as dashboards and folders.
Without NATS, every instance finds these changes by polling the database, separately for each part of Grafana that watches.
With embedded NATS turned on, the following changes on the default SQL storage backend:

- **No database polling for watches:** Each part of Grafana that watches subscribes to the bus, and only reads the rows that notifications point to.
  This covers the watch API, search index updates, and other internal consumers.
- **Ordering delay:** Each instance holds notifications for `[unified_storage] notifier_settle_delay`, `3s` by default, to put the writes of different instances back in order.
- **Expired watches instead of missed events:** NATS delivers each notification at most once.
  When Grafana detects a gap, it ends the open watches with an `Expired` error (HTTP status `410`), and their clients list again.
  Gaps include a reconnect to the bus, a notification dropped because a consumer fell too far behind, and a history row that can't be read.
- **Resumes that the bus can't cover:** A client that resumes a watch from a resource version from before the instance started, from before a write the instance lost, or older than the changes it still holds in memory, gets an `Expired` error and lists again.
- **A bound for undetected losses:** A notification can also be lost without either side noticing, for example while the connection between two instances is down after a restart.
  `notifier_watch_max_age` limits how long a watch can miss such a write.
  Grafana spreads the expiry of different watches over time.
- **Fallback to polling:** With `enabled = false` or `notifier = false`, watches poll the database as before.

## Monitor embedded NATS

Use the Grafana server log and metrics to check that the NATS cluster forms and stays healthy.

The following log messages show the state of the embedded server:

- **`started embedded nats server`:** Logged at startup with the advertised `route_url`, and whether `cluster_tls` and `route_auth` are on.
- **`detected nats cluster advertise address`:** Logged at startup with the address that Grafana detected.
- **`nats cluster port listens beyond loopback without cluster TLS`:** The route credential crosses the network in clear text.
  Turn on cluster TLS or restrict the cluster port.
- **`nats cluster routes wait for the route credential`:** Grafana couldn't read or create the route credential at startup, for example because the database wasn't reachable.
  Grafana retries in the background and logs `nats clustering enabled: the route credential is loaded` when it succeeds.
- **`reconciled nats cluster routes`:** Logged when the set of peers changes.
  In a healthy cluster, `peers` is the number of instances minus one.
- **`embedded nats advertising a loopback route url`:** Instances on other hosts can't connect to this instance.
  Check that the instances use MySQL or PostgreSQL, or set `listen_address` or `advertise_address`, as described in [Choose the address that peers connect to](#choose-the-address-that-peers-connect-to).
- **Warnings and errors from the `infra.nats.server` logger:** The embedded NATS server reports problems such as failed TLS handshakes or rejected routes here.

If you set `tls_enabled = true` in embedded mode, Grafana logs a warning at startup that the `tls_*` settings are ignored, because they only apply to an external NATS server.

The following metrics help you watch the bus:

- **`grafana_nats_embedded_server_up`:** `1` while the embedded server runs.
- **`grafana_nats_publisher_connection_status` and `grafana_nats_subscriber_connection_status`:** `1` while Grafana is connected to the bus.
- **`grafana_nats_publisher_publish_errors_total`:** Notifications that Grafana failed to publish.
- **`grafana_storage_server_nats_notifier_dropped_events_total`:** Notifications dropped before delivery, by `reason`.
- **`grafana_storage_server_sql_watch_missing_events_total`:** Writes that the SQL backend couldn't deliver to watches, by `reason`.
  Each one expires the open watches.

## Use your own NATS server

If you already run a NATS server, or you run Grafana in module mode, you can connect Grafana to that server instead of running the embedded one.
Set `mode = external` and list the server URLs in `client_urls`.
The `cluster_*`, `listen_address`, `advertise_address`, and `discovery_*` settings don't apply in this mode.

Use the `auth_mode` setting to choose how Grafana authenticates to your NATS server:

- **`token`:** Grafana presents the value of `token`.
- **`credentials`:** Grafana presents a NATS credentials file (`.creds`) that contains a user JWT and its seed.
  Set `credentials_file`, or set `publisher_credentials_file` and `subscriber_credentials_file` to give publishing and subscribing different identities.

The `token_exchange` mode requires Grafana Cloud services and isn't available for self-managed Grafana.

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
