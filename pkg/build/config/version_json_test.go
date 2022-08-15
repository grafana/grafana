package config_test

var configJSON = []byte(`{
  "pull_request": {
    "variants": [
      "linux-amd64",
      "linux-amd64-musl",
      "darwin-amd64",
      "windows-amd64"
    ],
    "pluginSignature": {
      "sign": false,
      "adminSign": false
    },
    "docker": {
      "shouldSave": false,
      "archs": [
        "amd64"
      ]
    }
  },
  "main": {
    "variants": [
      "linux-armv6",
      "linux-armv7",
      "linux-armv7-musl",
      "linux-arm64",
      "linux-arm64-musl",
      "darwin-amd64",
      "windows-amd64",
      "linux-amd64",
      "linux-amd64-musl"
    ],
    "pluginSignature": {
      "sign": true,
      "adminSign": true
    },
    "docker": {
      "shouldSave": false,
      "archs": [
        "amd64",
        "arm64",
        "armv7"
      ]
    },
    "packagesBucket": "grafana-downloads",
    "CDNAssetsBucket": "grafana-static-assets"
  },
  "branch": {
    "variants": [
      "linux-armv6",
      "linux-armv7",
      "linux-armv7-musl",
      "linux-arm64",
      "linux-arm64-musl",
      "darwin-amd64",
      "windows-amd64",
      "linux-amd64",
      "linux-amd64-musl"
    ],
    "pluginSignature": {
      "sign": true,
      "adminSign": true
    },
    "docker": {
      "shouldSave": true,
      "archs": [
        "amd64",
        "arm64",
        "armv7"
      ]
    },
    "packagesBucket": "grafana-downloads",
    "packagesBucketEnterprise2": "grafana-downloads-enterprise2",
    "CDNAssetsBucket": "grafana-static-assets"
  },
  "release": {
    "variants": [
      "linux-armv6",
      "linux-armv7",
      "linux-armv7-musl",
      "linux-arm64",
      "linux-arm64-musl",
      "darwin-amd64",
      "windows-amd64",
      "linux-amd64",
      "linux-amd64-musl"
    ],
    "pluginSignature": {
      "sign": true,
      "adminSign": true
    },
    "docker": {
      "shouldSave": true,
      "archs": [
        "amd64",
        "arm64",
        "armv7"
      ]
    },
    "packagesBucket": "grafana-prerelease/artifacts/downloads",
    "CDNAssetsBucket": "grafana-prerelease",
    "CDNAssetsDir": "artifacts/static-assets",
    "storybookBucket": "grafana-prerelease",
    "storybookSrcDir": "artifacts/storybook"
  },
  "beta": {
    "variants": [
      "linux-armv6",
      "linux-armv7",
      "linux-armv7-musl",
      "linux-arm64",
      "linux-arm64-musl",
      "darwin-amd64",
      "windows-amd64",
      "linux-amd64",
      "linux-amd64-musl"
    ],
    "pluginSignature": {
      "sign": true,
      "adminSign": true
    },
    "docker": {
      "shouldSave": true,
      "archs": [
        "amd64",
        "arm64",
        "armv7"
      ]
    },
    "packagesBucket": "grafana-prerelease/artifacts/downloads",
    "CDNAssetsBucket": "grafana-prerelease",
    "CDNAssetsDir": "artifacts/static-assets",
    "storybookBucket": "grafana-prerelease",
    "storybookSrcDir": "artifacts/storybook"
  },
  "test": {
    "variants": [
      "linux-armv6",
      "linux-armv7",
      "linux-armv7-musl",
      "linux-arm64",
      "linux-arm64-musl",
      "darwin-amd64",
      "windows-amd64",
      "linux-amd64",
      "linux-amd64-musl"
    ],
    "pluginSignature": {
      "sign": true,
      "adminSign": true
    },
    "docker": {
      "shouldSave": true,
      "archs": [
        "amd64",
        "arm64",
        "armv7"
      ]
    },
    "packagesBucket": "grafana-prerelease/artifacts/downloads",
    "CDNAssetsBucket": "grafana-prerelease",
    "CDNAssetsDir": "artifacts/static-assets",
    "storybookBucket": "grafana-prerelease",
    "storybookSrcDir": "artifacts/storybook"
  }
}`)
