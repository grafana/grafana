package config

var Versions = VersionMap{
	PullRequestMode: {
		Variants: []Variant{
			VariantLinuxAmd64,
			VariantLinuxAmd64Musl,
			VariantDarwinAmd64,
			VariantWindowsAmd64,
		},
		PluginSignature: PluginSignature{
			Sign:      false,
			AdminSign: false,
		},
		Docker: Docker{
			ShouldSave: false,
			Architectures: []Architecture{
				ArchAMD64,
			},
		},
	},
	MainMode: {
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
				ArchARMv7, // GOARCH=ARM is used for both armv6 and armv7. They are differentiated by the GOARM variable.
			},
		},
		PackagesBucket:            "grafana-downloads",
		PackagesBucketEnterprise2: "grafana-downloads-enterprise2",
		CDNAssetsBucket:           "grafana-static-assets",
	},
	ReleaseBranchMode: {
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
			ShouldSave: true,
			Architectures: []Architecture{
				ArchAMD64,
				ArchARM64,
				ArchARMv7,
			},
		},
		PackagesBucket:            "grafana-downloads",
		PackagesBucketEnterprise2: "grafana-downloads-enterprise2",
		CDNAssetsBucket:           "grafana-static-assets",
	},
	TagMode: {
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
			ShouldSave: true,
			Architectures: []Architecture{
				ArchAMD64,
				ArchARM64,
				ArchARMv7,
			},
		},
		PackagesBucket:  "grafana-prerelease/artifacts/downloads",
		CDNAssetsBucket: "grafana-prerelease",
		CDNAssetsDir:    "artifacts/static-assets",
		StorybookBucket: "grafana-prerelease",
		StorybookSrcDir: "artifacts/storybook",
	},
}
