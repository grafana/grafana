+++
title = "Sign a plugin"
type = "docs"
+++

# Sign a plugin

Signing a plugin allows Grafana to verify the authenticity of the plugin with [signature verification]({{< relref "../../plugins/plugin-signatures.md" >}}). This gives users a way to make sure plugins haven't been tampered with. All Grafana Labs-authored backend plugins, including Enterprise plugins, are signed.

Plugin signature verification (signing) is a security measure to make sure plugins haven't been tampered with. Upon loading, Grafana checks to see if a plugin is signed or unsigned when inspecting and verifying its digital signature.

> **Important:** Future versions of Grafana will require all plugins to be signed.

## Sign your plugin using Grafana Toolkit

The easiest way to sign your plugin is by using the [Grafana Toolkit](https://www.npmjs.com/package/@grafana/toolkit).

You can sign your plugin as a _public_ or a _private_ plugin. In both cases, you need to [create an account on Grafana.com](https://grafana.com/signup) and generate an API key with the `PluginPublisher` role. By creating an account, you can verify that you own the plugin that you want to sign.

### Sign a public plugin

Plugins signed under the community or commercial signature level are considered _public plugins_. Public plugins are published on [Grafana Plugin](https://grafana.com/plugins). For more information about installing public plugins, refer to [Install Grafana plugins]({{< relref "../../plugins/installation.md" >}}).

1. Request a plugin signature level by sending an email to [XXX@grafana.com](mailto:XXX@grafana.com).

1. Sign the plugin with the API key you just created. Grafana Toolkit creates a [MANIFEST.txt](#plugin-manifest) file in the `dist` directory of your plugin.

   ```
   export GRAFANA_API_KEY=<YOUR_API_KEY>
   npx @grafana/toolkit plugin:sign
   ```

### Sign a private plugin

If you're developing plugins for internal use only and don't want to make it public, you can sign it under a Private [signature level](#plugin-signature-levels).

1. Sign the plugin with the API key you just created. Grafana Toolkit creates a [MANIFEST.txt](#plugin-manifest) file in the `dist` directory of your plugin.

   The `rootUrls` flag accepts a comma-separated list of URLs for which the plugin can be used. The URLs need to match the [root_url]({{< relref "../../administration/configuration.md#root_url" >}}) setting.

   ```
   export GRAFANA_API_KEY=<YOUR_API_KEY>
   npx @grafana/toolkit plugin:sign --rootUrls https://example.com/grafana
   ```

## Plugin signature levels

To sign a plugin, you need to decide the _signature level_ you want to sign it under. The signature level of your plugin determines how you can distribute it.

You can sign your plugin under three different _signature levels_.

|**Plugin Level**|**Paid Subscription Required?**|**Description**|
|---|---|---|
|Private|No;<br>Free of charge|<p>You can create and sign a Private Plugin for any technology at no charge.</p><p>Private Plugins are for use on your own Grafana. They may not be distributed to the Grafana community, and are not published in the Grafana catalog.</p>|
|Community|No;<br>Free of charge|<p>You can create, sign and distribute plugins at no charge, provided that all dependent technologies are open source and not for profit.</p><p>Community Plugins are published in the official Grafana catalog, and are available to the Grafana community.</p>|
|Commercial|Yes;<br>Commercial Plugin Subscription required|<p>You can create, sign and distribute plugins with dependent technologies that are closed source or commercially backed, by entering into a Commercial Plugin Subscription with Grafana Labs.</p><p>Commercial Plugins are published on the official Grafana catalog, and are available to the Grafana community.</p>|

## Plugin manifest

For Grafana to verify the digital signature of a plugin, the plugin must include a signed manifest file, _MANIFEST.txt_. The signed manifest file contains two sections:

- **Signed message -** The signed message contains plugin metadata and plugin files with their respective checksums (SHA256).
- **Digital signature -**  The digital signature is created by encrypting the signed message using a private key. Grafana has a public key built-in that can be used to verify that the digital signature have been encrypted using expected private key.

**Example manifest file:**

```txt
// MANIFEST.txt
-----BEGIN PGP SIGNED MESSAGE-----
Hash: SHA512

{
  "plugin": "grafana-test-plugin",
  "version": "1.0.0",
  "files": {
    "LICENSE": "cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30",
    "README.md": "5bfefcdce6eafce3388d1fb200f3b10954cfeac6c7a45fd7dec42687e01ac75d",
    "module.js": "3c07596a6a4796c65ef10ba2bc0805e7f3bc9e4e8fc9970a1307b97e29db1c0a",
    "module.js.LICENSE.txt": "fdbc28c10f3d21976b4bc16464ad7c630538c0c3101347b5fd44af9066f7022b",
    "module.js.map": "c3ac1e8aa98d83c54fd13e43b65e1cf4182a924d2eb23a2f1a6fe40b7785a1bb",
    "plugin.json": "cf26a3afb7c10cd9ae40b5296d04172b5dac927d69a51082e6d085b34341ccc3"
  },
  "time": 1589558058070,
  "keyId": "7e4d0c6a708866e7"
}
-----BEGIN PGP SIGNATURE-----
Version: OpenPGP.js v4.10.1
Comment: https://openpgpjs.org

wqAEARMKAAYFAl6+uyoACgkQfk0ManCIZuc0+QIHdWC0dp7GRRFu3Hgk9tnl
FJnPwM6Y2tTdq7AkpVTTAb3RTFadA8dRmLfajxgHxmDf5yUv9M2M6sa1eTSG
8kJtOlwCB096dXOKsH1IOGQMCY+/xM2081FqbMTvWgN81xrxMoxftQn8z6VC
2nA2Rmt1VStppFVCCUXaq6Y4sFGHQF/yq5oi
=vqUQ
-----END PGP SIGNATURE-----

```
