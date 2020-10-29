+++
title = "Sign a plugin"
type = "docs"
+++

# Sign a plugin

Signing a plugin allows Grafana to verify the authenticity of the plugin with [signature verification]({{< relref "../../plugins/plugin-signature-verification.md" >}}). This gives users a way to make sure plugins haven't been tampered with. All Grafana Labs-authored backend plugins, including Enterprise plugins, are signed.

## Plugin signature level

You can sign your plugin under three different _signature levels_.

|**Plugin Level**|**Paid Subscription Required?**|**Description**|
|---|---|---|
|Private|No;<br>Free of charge|<p>You can create and sign a Private Plugin for any technology at no charge.</p><p>Private Plugins are for use on your own Grafana. They may not be distributed to the Grafana community, and are not published in the Grafana catalog.</p>|
|Community|No;<br>Free of charge|<p>You can create, sign and distribute plugins at no charge, provided that all dependent technologies are open source and not for profit.</p><p>Community Plugins are published in the official Grafana catalog, and are available to the Grafana community.</p>|
|Commercial|Yes;<br>Commercial Plugin Subscription required|<p>You can create, sign and distribute plugins with dependent technologies that are closed source or commercially backed, by entering into a Commercial Plugin Subscription with Grafana Labs.</p><p>Commercial Plugins are published on the official Grafana catalog, and are available to the Grafana community.</p>|
