---
aliases:
  - plugin-signature-verification/
title: Plugin signatures
type: docs
---

# Plugin signatures

Plugin signature verification (signing) is a security measure to make sure plugins haven't been tampered with. Upon loading, Grafana checks to see if a plugin is signed or unsigned when inspecting and verifying its digital signature.

At startup, Grafana verifies the signatures of every plugin in the plugin directory. If a plugin is unsigned, then Grafana does not load nor start it. To see the result of this verification for each plugin, navigate to **Configuration** -> **Plugins**.

Grafana also writes an error message to the server log:

```bash
WARN[05-26|12:00:00] Some plugin scanning errors were found   errors="plugin '<plugin id>' is unsigned, plugin '<plugin id>' has an invalid signature"
```

If you are a plugin developer and want to know how to sign your plugin, refer to [Sign a plugin]({{< relref "../developers/plugins/sign-a-plugin.md" >}}).

| Signature status   | Description                                                                     |
| ------------------ | ------------------------------------------------------------------------------- |
| Core               | Core plugin built into Grafana.                                                 |
| Invalid signature  | The plugin has a invalid signature.                                             |
| Modified signature | The plugin has changed since it was signed. This may indicate malicious intent. |
| Unsigned           | The plugin is not signed.                                                       |
| Signed             | The plugin signature was successfully verified.                                 |

## Plugin signature levels

All plugins is signed under a _signature level_. The signature level determines how the plugin can be distributed.

| **Plugin Level** | **Description**                                                                                                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Private          | <p>Private plugins are for use on your own Grafana. They may not be distributed to the Grafana community, and are not published in the Grafana catalog.</p>                                                              |
| Community        | <p>Community plugins have dependent technologies that are open source and not for profit.</p><p>Community plugins are published in the official Grafana catalog, and are available to the Grafana community.</p>         |
| Commercial       | <p>Commercial plugins have dependent technologies that are closed source or commercially backed.</p><p>Commercial Plugins are published on the official Grafana catalog, and are available to the Grafana community.</p> |

## Allow unsigned plugins

> **Note:** Unsigned plugins are not supported in Grafana Cloud.

We strongly recommend that you don't run unsigned plugins in your Grafana instance. If you're aware of the risks and you still want to load an unsigned plugin, refer to [Configuration]({{< relref "../administration/configuration.md#allow_loading_unsigned_plugins" >}}).

If you've allowed loading of an unsigned plugin, then Grafana writes a warning message to the server log:

```bash
WARN[06-01|16:45:59] Running an unsigned plugin   pluginID=<plugin id>
```

> **Note:** If you're developing a plugin, then you can enable development mode to allow all unsigned plugins.
