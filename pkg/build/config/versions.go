package config

const PublicBucket = "grafana-downloads"

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
			Distribution: []Distribution{
				Alpine,
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
			Distribution: []Distribution{
				Alpine,
				Ubuntu,
			},
		},
		Buckets: Buckets{
			Artifacts:            "grafana-downloads",
			ArtifactsEnterprise2: "grafana-downloads-enterprise2",
			CDNAssets:            "grafana-static-assets",
			Storybook:            "grafana-storybook",
		},
	},
	DownstreamMode: {
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
				ArchARMv7, // GOARCH=ARM is used for both armv6 and armv7. They are differentiated by the GOARM variable.
			},
			Distribution: []Distribution{
				Alpine,
				Ubuntu,
			},
		},
		Buckets: Buckets{
			Artifacts:            "grafana-downloads",
			ArtifactsEnterprise2: "grafana-downloads-enterprise2",
			CDNAssets:            "grafana-static-assets",
		},
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
			Distribution: []Distribution{
				Alpine,
				Ubuntu,
			},
			PrereleaseBucket: "grafana-prerelease/artifacts/docker",
		},
		Buckets: Buckets{
			Artifacts:            "grafana-downloads",
			ArtifactsEnterprise2: "grafana-downloads-enterprise2",
			CDNAssets:            "grafana-static-assets",
		},
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
			Distribution: []Distribution{
				Alpine,
				Ubuntu,
			},
			PrereleaseBucket: "grafana-prerelease/artifacts/docker",
		},
		Buckets: Buckets{
			Artifacts:            "grafana-prerelease/artifacts/downloads",
			ArtifactsEnterprise2: "grafana-prerelease/artifacts/downloads-enterprise2",
			CDNAssets:            "grafana-prerelease",
			CDNAssetsDir:         "artifacts/static-assets",
			Storybook:            "grafana-prerelease",
			StorybookSrcDir:      "artifacts/storybook",
		},
	},
	Enterprise2Mode: {
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
			Distribution: []Distribution{
				Alpine,
				Ubuntu,
			},
			PrereleaseBucket: "grafana-prerelease/artifacts/docker",
		},
		Buckets: Buckets{
			Artifacts:            "grafana-prerelease/artifacts/downloads",
			ArtifactsEnterprise2: "grafana-prerelease/artifacts/downloads-enterprise2",
			CDNAssets:            "grafana-prerelease",
			CDNAssetsDir:         "artifacts/static-assets",
			Storybook:            "grafana-prerelease",
			StorybookSrcDir:      "artifacts/storybook",
		},
	},
	CloudMode: {
		Variants: []Variant{
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
			},
			Distribution: []Distribution{
				Alpine,
			},
			PrereleaseBucket: "grafana-prerelease/artifacts/docker",
		},
		Buckets: Buckets{
			Artifacts:            "grafana-prerelease/artifacts/downloads",
			ArtifactsEnterprise2: "grafana-prerelease/artifacts/downloads-enterprise2",
			CDNAssets:            "grafana-prerelease",
			CDNAssetsDir:         "artifacts/static-assets",
			Storybook:            "grafana-prerelease",
			StorybookSrcDir:      "artifacts/storybook",
		},
	},
}
