+++
title = "Signing"
type = "docs"
+++

# Signing

Plugin signing is a security measure to make sure plugins haven't been tampered with. Grafana will verify if a plugin is signed or unsigned when loading it by inspecting and verifying its digital signature.

> Note: All Grafana Labs authored backend plugins, including Enterprise plugins, are signed. We're looking into providing a process for allowing  community plugins to be signed in an upcoming version of Grafana.

## Sign a plugin

Signing a plugin is the process of creating a signed manifest file, _MANIFEST.txt_. The first step is to create the plugin manifest. This is a JSON file that should contain the same plugin id and version found in `plugin.json`. The list of plugin files with their respective checksums (SHA256) should all be included as `files`. Example plugin manifest:

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

Next, the plugin manifest is signed with a private key and the _MANIFEST.txt_ is created. The manifest signing process is offloaded to the grafana.com HTTP API and is currently only available for Grafana Labs authored plugins. The HTTP API result is stored as _MANIFEST.txt_ side by side with `plugin.json` and other plugin files. The last step is to archive the plugin as a zip-file.

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

## Verify a plugin

When Grafana starts it discovers plugins to load. For each discovered plugin it verifies the authenticity of it, and then decides whether to load it or not based on the state of the plugin signature:

| Plugin signature | Description |
| ---------------- | ----------- |
| internal | Core plugin built into Grafana. |
| unsigned | Plugin don't have a _MANIFEST.txt_ file. |
| invalid  | Digital signature of _MANIFEST.txt_ file is not valid. |
| modified | Manifest plugin id or version have been changed or files checksums doesn't match. |
| valid    | If any of the above descriptions is false. |

The plugin signature state can be inspected for each plugin in the plugins listing page (Configuration -> Plugins).

### Backend plugins

If a [backend plugin]({{< relref "backend/_index.md" >}}) is not signed then Grafana will not load or start it. Trying to load a backend plugin with an invalid signature, then Grafana writes an error message to the server log:

```bash
EROR[06-01|16:45:59] Failed to load plugin   error=plugin <plugin id> is unsigned
```

### Allow unsigned plugins

While you can allow unsigned plugins using a configuration setting, we strongly advise you not to. For more information on how to allow unsigned backend plugin, refer to [Configuration]({{< relref "../../installation/configuration.md#allow-loading-unsigned-plugins" >}}).

If you run an unsigned backend plugin, then Grafana writes a warning message to the server log:

```bash
WARN[06-01|16:45:59] Running an unsigned backend plugin   pluginID=<plugin id>
```

If you're developing plugins and run Grafana from source the development mode will be enabled per default and also allow you to run unsigned backend plugins.
