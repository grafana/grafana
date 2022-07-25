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
	"branch": {
		Variants: []Variant{
			VariantArmV6,
			VariantArmV7,
			VariantArmV7Musl,
			VariantArm64,
			VariantArm64Musl,
			VariantDarwinAmd64,
			VariantWindowsAmd64,
			VariantLinuxAmd64,
			VariantLinuxAmd64,
		},
		PluginSignature: PluginSignature{
			Sign:      true,
			AdminSign: true,
		},
		Docker: Docker{
			ShouldSave: true,
			Architectures: []Architecture{
				ArchAMD64,
				ArchARM64,
				ArchARM,
			},
		},
		PackagesBucket:            "grafana-downloads",
		PackagesBucketEnterprise2: "grafana-downloads-enterprise2",
		CDNAssetsBucket:           "grafana-static-assets",
	},
	"release": {
		Variants: []Variant{
			VariantArmV6,
			VariantArmV7,
			VariantArmV7Musl,
			VariantArm64,
			VariantArm64Musl,
			VariantDarwinAmd64,
			VariantWindowsAmd64,
			VariantLinuxAmd64,
			VariantLinuxAmd64,
		},
		PluginSignature: PluginSignature{
			Sign:      true,
			AdminSign: true,
		},
		Docker: Docker{
			ShouldSave: true,
			Architectures: []Architecture{
				ArchAMD64,
				ArchARM64,
				ArchARM,
			},
		},
		PackagesBucket:  "grafana-prerelease/artifacts/downloads",
		CDNAssetsBucket: "grafana-prerelease",
		CDNAssetsDir:    "artifacts/static-assets",
		StorybookBucket: "grafana-prerelease",
		StorybookSrcDir: "artifacts/storybook",
	},
	"beta": {
		Variants: []Variant{
			VariantArmV6,
			VariantArmV7,
			VariantArmV7Musl,
			VariantArm64,
			VariantArm64Musl,
			VariantDarwinAmd64,
			VariantWindowsAmd64,
			VariantLinuxAmd64,
			VariantLinuxAmd64,
		},
		PluginSignature: PluginSignature{
			Sign:      true,
			AdminSign: true,
		},
		Docker: Docker{
			ShouldSave: true,
			Architectures: []Architecture{
				ArchAMD64,
				ArchARM64,
				ArchARM,
			},
		},
		PackagesBucket:  "grafana-prerelease/artifacts/downloads",
		CDNAssetsBucket: "grafana-prerelease",
		CDNAssetsDir:    "artifacts/static-assets",
		StorybookBucket: "grafana-prerelease",
		StorybookSrcDir: "artifacts/storybook",
	},
	"test": {
		Variants: []Variant{
			VariantArmV6,
			VariantArmV7,
			VariantArmV7Musl,
			VariantArm64,
			VariantArm64Musl,
			VariantDarwinAmd64,
			VariantWindowsAmd64,
			VariantLinuxAmd64,
			VariantLinuxAmd64,
		},
		PluginSignature: PluginSignature{
			Sign:      true,
			AdminSign: true,
		},
		Docker: Docker{
			ShouldSave: true,
			Architectures: []Architecture{
				ArchAMD64,
				ArchARM64,
				ArchARM,
			},
		},
		PackagesBucket:  "grafana-prerelease/artifacts/downloads",
		CDNAssetsBucket: "grafana-prerelease",
		CDNAssetsDir:    "artifacts/static-assets",
		StorybookBucket: "grafana-prerelease",
		StorybookSrcDir: "artifacts/storybook",
	},
}
