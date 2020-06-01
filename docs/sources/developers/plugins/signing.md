+++
title = "Signing"
type = "docs"
+++

# Signing

Signing is an additional security measure to make sure plugins you authored, installed or using haven't been tampered with. Grafana will verify whether a plugin is signed or unsigned when starting up and loading plugins by inspecting and verifying its digital signature, if any.

> Note: All Grafana Labs authored backend plugins, including Enterprise plugins, are signed. We're looking into providing a process for allowing  community plugins to be signed in an upcoming version of Grafana.

## Signing a plugin

Signing a plugin is the process of creating a signed manifest file, _MANIFEST.txt_. The first step is to create the plugin manifest. This is a JSON file that should contain the same plugin id and version found in `plugin.json`. The list of plugin files with their respective checksums (SHA256) should alow be included as `files`. Example plugin manifest:

```json
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
  }
}
```

Next the plugin manifest is signed with a private key and create the _MANIFEST.txt_. The manifest signing process is offloaded to the grafana.com HTTP API and is currently only available for Grafana Labs authored plugins. The HTTP API result is stored as _MANIFEST.txt_ side by side with `plugin.json` and other plugin files. The last step is to archive the plugin as a zip-file.

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

## Verifying a plugin

When Grafana starts up it discover which plugins to load. For each plugin it verifies the authenticity of it, whether to load it or not based on the state of the plugin signature.

1. If plugin is a core plugin built into Grafana, plugin signature is `internal`.
1. If no _MANIFEST.txt_ file is found, plugin signature is `unsigned`.
1. Using the public key (compiled with Grafana), if the digital signature of _MANIFEST.txt_ is not valid, plugin signature is `invalid`.
1. If manifest plugin id or version have been changed, plugin signature is `modified`.
1. If manifest files checksums doesn't match, plugin signature is `modified`.
1. If all earlier steps passes, plugin signature is `valid`.

The plugin signature state can be inspected for each plugin in the plugins listing page (Configuration -> Plugins).

### Backend plugins

If a [backend plugin]({{< relref "backend/_index.md" >}}) is not signed Grafana will not load/start it. Trying to load a backend plugin with an invalid sigature will write an error message to the Grafana server log `plugin <plugin id> is unsigned`.

### Allow unsigned plugins

It's possible to allow unsigned plugins using a configuration setting, but is something we strongly advise against doing. Read more [here]({{< relref "../../installation/configuration.md#allow-loading-unsigned-plugins" >}}) about this setting. Running an unsiged backend plugin will write a warning message to the Grafana server log `Running an unsigned backend plugin   pluginID=<plugin id>`.
