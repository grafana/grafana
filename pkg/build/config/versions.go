package config

var Versions = map[string]Version{
	"pull_request": {
		Variants: []Variant{
			VariantLinuxAmd64,
			VariantLinuxAmd64Musl,
			VariantDarwinAmd64,
			VariantWindowsAmd64,
		},
		PluginSignature: PluginSignature{
			Sign:      true,
			AdminSign: true,
		},
		Docker: Docker{
			ShouldSave: false,
			Architectures: []Architecture{
				ArchAMD64,
			},
		},
	},
	"main": {
		Variants: []Variant{
			VariantArmV6,
			VariantArmV7,
			VariantArmV7Musl,
			VariantArm64,
			VariantArm64Musl,
			VariantDarwinAmd64,
			VariantWindowsAmd64,
			VariantLinuxAmd64,
			VariantLinuxAmd64Musl,
		},
		PluginSignature: PluginSignature{
			Sign:      true,
			AdminSign: true,
		},
		Docker: Docker{
			ShouldSave: false,
			Architectures: []Architecture{
				ArchAMD64,
				ArchARM64,
				ArchARM, // GOARCH=ARM is used for both armv6 and armv7. They are differentiated by the GOARM variable.
			},
		},
	},
}

// {
//     "docker": {
//       "shouldSave": false,
//       "archs": [
//         "amd64",
//         "arm64",
//         "armv7"
//       ]
//     },
//     "packagesBucket": "grafana-downloads",
//     "CDNAssetsBucket": "grafana-static-assets"
//   },
//   "branch": {
//     "variants": [
//       "linux-armv6",
//       "linux-armv7",
//       "linux-armv7-musl",
//       "linux-arm64",
//       "linux-arm64-musl",
//       "darwin-amd64",
//       "windows-amd64",
//       "linux-amd64",
//       "linux-amd64-musl"
//     ],
//     "pluginSignature": {
//       "sign": true,
//       "adminSign": true
//     },
//     "docker": {
//       "shouldSave": true,
//       "archs": [
//         "amd64",
//         "arm64",
//         "armv7"
//       ]
//     },
//     "packagesBucket": "grafana-downloads",
//     "packagesBucketEnterprise2": "grafana-downloads-enterprise2",
//     "CDNAssetsBucket": "grafana-static-assets"
//   },
//   "release": {
//     "variants": [
//       "linux-armv6",
//       "linux-armv7",
//       "linux-armv7-musl",
//       "linux-arm64",
//       "linux-arm64-musl",
//       "darwin-amd64",
//       "windows-amd64",
//       "linux-amd64",
//       "linux-amd64-musl"
//     ],
//     "pluginSignature": {
//       "sign": true,
//       "adminSign": true
//     },
//     "docker": {
//       "shouldSave": true,
//       "archs": [
//         "amd64",
//         "arm64",
//         "armv7"
//       ]
//     },
//     "packagesBucket": "grafana-prerelease/artifacts/downloads",
//     "CDNAssetsBucket": "grafana-prerelease",
//     "CDNAssetsDir": "artifacts/static-assets",
//     "storybookBucket": "grafana-prerelease",
//     "storybookSrcDir": "artifacts/storybook"
//   },
//   "beta": {
//     "variants": [
//       "linux-armv6",
//       "linux-armv7",
//       "linux-armv7-musl",
//       "linux-arm64",
//       "linux-arm64-musl",
//       "darwin-amd64",
//       "windows-amd64",
//       "linux-amd64",
//       "linux-amd64-musl"
//     ],
//     "pluginSignature": {
//       "sign": true,
//       "adminSign": true
//     },
//     "docker": {
//       "shouldSave": true,
//       "archs": [
//         "amd64",
//         "arm64",
//         "armv7"
//       ]
//     },
//     "packagesBucket": "grafana-prerelease/artifacts/downloads",
//     "CDNAssetsBucket": "grafana-prerelease",
//     "CDNAssetsDir": "artifacts/static-assets",
//     "storybookBucket": "grafana-prerelease",
//     "storybookSrcDir": "artifacts/storybook"
//   },
//   "test": {
//     "variants": [
//       "linux-armv6",
//       "linux-armv7",
//       "linux-armv7-musl",
//       "linux-arm64",
//       "linux-arm64-musl",
//       "darwin-amd64",
//       "windows-amd64",
//       "linux-amd64",
//       "linux-amd64-musl"
//     ],
//     "pluginSignature": {
//       "sign": true,
//       "adminSign": true
//     },
//     "docker": {
//       "shouldSave": true,
//       "archs": [
//         "amd64",
//         "arm64",
//         "armv7"
//       ]
//     },
//     "packagesBucket": "grafana-prerelease/artifacts/downloads",
//     "CDNAssetsBucket": "grafana-prerelease",
//     "CDNAssetsDir": "artifacts/static-assets",
//     "storybookBucket": "grafana-prerelease",
//     "storybookSrcDir": "artifacts/storybook"
//   }
// }
