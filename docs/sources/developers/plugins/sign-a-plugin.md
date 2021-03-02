+++
title = "Sign a plugin"
+++

# Sign a plugin

Signing a plugin allows Grafana to verify the authenticity of the plugin with [signature verification]({{< relref "../../plugins/plugin-signatures.md" >}}). This gives users a way to make sure plugins haven't been tampered with. All Grafana Labs-authored backend plugins, including Enterprise plugins, are signed.

> **Important:** Future versions of Grafana will require all plugins to be signed.

## Sign your plugin using Grafana Toolkit

The easiest way to sign your plugin is by using the [Grafana Toolkit](https://www.npmjs.com/package/@grafana/toolkit).

You can sign your plugin as a _public_ or a _private_ plugin. In both cases, you need to [create an account on Grafana.com](https://grafana.com/signup) and generate an API key with the `PluginPublisher` role. By creating an account, you can verify that you own the plugin that you want to sign.

### Sign a public plugin

Plugins signed under the community or commercial signature level are considered _public plugins_. Public plugins are published on [Grafana Plugin](https://grafana.com/plugins). For more information about installing public plugins, refer to [Install Grafana plugins]({{< relref "../../plugins/installation.md" >}}).

1. Submit your plugin for review by creating a pull request in the [grafana-plugin-repository](https://github.com/grafana/grafana-plugin-repository).
1. When your plugin is approved, you're granted a [plugin signature level](#plugin-signature-levels). **Without a plugin signature level, you won't be able to sign your plugin**.
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

For instructions on how to sign a plugin under the Community and Commercial signature level, refer to [Sign a public plugin](#sign-a-public-plugin).

For instructions on how to sign a plugin under the Private signature level, refer to [Sign a private plugin](#sign-a-private-plugin).

## Plugin manifest

For Grafana to verify the digital signature of a plugin, the plugin must include a signed manifest file, _MANIFEST.txt_. The signed manifest file contains two sections:

- **Signed message -** The signed message contains plugin metadata and plugin files with their respective checksums (SHA256).
- **Digital signature -**  The digital signature is created by encrypting the signed message using a private key. Grafana has a public key built-in that can be used to verify that the digital signature have been encrypted using expected private key.

**Example manifest file:**

```txt
-----BEGIN PGP SIGNED MESSAGE-----
Hash: SHA512

{
  "manifestVersion": "2.0.0",
  "signatureType": "community",
  "signedByOrg": "myorgid",
  "signedByOrgName": "My Org",
  "plugin": "myorgid-simple-panel",
  "version": "1.0.0",
  "time": 1602753404133,
  "keyId": "7e4d0c6a708866e7",
  "files": {
    "LICENSE": "12ab7a0961275f5ce7a428e662279cf49bab887d12b2ff7bfde738346178c28c",
    "module.js.LICENSE.txt": "0d8f66cd4afb566cb5b7e1540c68f43b939d3eba12ace290f18abc4f4cb53ed0",
    "module.js.map": "8a4ede5b5847dec1c6c30008d07bef8a049408d2b1e862841e30357f82e0fa19",
    "plugin.json": "13be5f2fd55bee787c5413b5ba6a1fae2dfe8d2df6c867dadc4657b98f821f90",
    "README.md": "2d90145b28f22348d4f50a81695e888c68ebd4f8baec731fdf2d79c8b187a27f",
    "module.js": "b4b6945bbf3332b08e5e1cb214a5b85c82557b292577eb58c8eb1703bc8e4577"
  }
}
-----BEGIN PGP SIGNATURE-----
Version: OpenPGP.js v4.10.1
Comment: https://openpgpjs.org

wqEEARMKAAYFAl+IE3wACgkQfk0ManCIZudpdwIHTCqjVzfm7DechTa7BTbd
+dNIQtwh8Tv2Q9HksgN6c6M9nbQTP0xNHwxSxHOI8EL3euz/OagzWoiIWulG
7AQo7FYCCQGucaLPPK3tsWaeFqVKy+JtQhrJJui23DAZLSYQYZlKQ+nFqc9x
T6scfmuhWC/TOcm83EVoCzIV3R5dOTKHqkjIUg==
=GdNq
-----END PGP SIGNATURE-----
```

## Troubleshooting issues while signing your plugin

### Why am I getting a "Modified signature" in Grafana?

Due to an issue when signing the plugin on Windows, grafana-toolkit generates an invalid MANIFEST.txt. You can fix this by replacing all double backslashes, `\\`, with a forward slash, `/` in the MANIFEST.txt file. You need to do this every time you sign your plugin.

### Error signing manifest: Field is required: rootUrls

If you're trying to sign a **public** plugin, this means that your plugin doesn't have a plugin signature level assigned to it yet. A Grafana team member will assign a signature level to your plugin once it has been reviewed and approved. For more information, refer to [Sign a public plugin](#sign-a-public-plugin).

If you're trying to sign a **private** plugin, this means that you need to add a `rootUrls` flag to the `plugin:sign` command. The `rootUrls` must match the [root_url]({{< relref "../../administration/configuration.md#root_url" >}}) configuration. For more information, refer to [Sign a private plugin](#sign-a-private-plugin).
