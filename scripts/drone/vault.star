"""
This module returns functions for generating Drone secrets fetched from Vault.
"""
gcr_pull_secret = "gcr"
gar_pull_secret = "gar"
drone_token = "drone_token"
prerelease_bucket = "prerelease_bucket"
gcp_upload_artifacts_key = "gcp_upload_artifacts_key"
gcp_grafanauploads = "gcp_grafanauploads"
gcp_grafanauploads_base64 = "gcp_grafanauploads_base64"
gcp_download_build_container_assets_key = "gcp_download_build_container_assets_key"

azure_sp_app_id = "azure_sp_app_id"
azure_sp_app_pw = "azure_sp_app_pw"
azure_tenant = "azure_tenant"

github_app_app_id = "github-app-app-id"
github_app_app_installation_id = "github-app-installation-id"
github_app_private_key = "github-app-private-key"

rgm_gcp_key_base64 = "gcp_key_base64"
rgm_destination = "destination"
rgm_storybook_destination = "rgm_storybook_destination"
rgm_cdn_destination = "rgm_cdn_destination"
rgm_downloads_destination = "rgm_downloads_destination"
rgm_dagger_token = "dagger_token"

docker_username = "docker_username"
docker_password = "docker_password"

npm_token = "npm_token"

def from_secret(secret):
    return {"from_secret": secret}

def vault_secret(name, path, key):
    return {
        "kind": "secret",
        "name": name,
        "get": {
            "path": path,
            "name": key,
        },
    }

def secrets():
    return [
        vault_secret(github_app_app_id, "ci/data/repo/grafana/grafana/github-app", "app-id"),
        vault_secret(github_app_app_installation_id, "ci/data/repo/grafana/grafana/github-app", "app-installation-id"),
        vault_secret(github_app_private_key, "ci/data/repo/grafana/grafana/github-app", "private-key"),
        vault_secret(gcp_grafanauploads, "infra/data/ci/grafana-release-eng/grafanauploads", "credentials.json"),
        vault_secret(gcp_grafanauploads_base64, "infra/data/ci/grafana-release-eng/grafanauploads", "credentials_base64"),
        vault_secret("grafana_api_key", "infra/data/ci/grafana-release-eng/grafanacom", "api_key"),
        vault_secret(gcr_pull_secret, "secret/data/common/gcr", ".dockerconfigjson"),
        vault_secret(gar_pull_secret, "secret/data/common/gar", ".dockerconfigjson"),
        vault_secret(drone_token, "infra/data/ci/drone", "machine-user-token"),
        vault_secret(prerelease_bucket, "infra/data/ci/grafana/prerelease", "bucket"),
        vault_secret(docker_username, "infra/data/ci/grafanaci-docker-hub", "username"),
        vault_secret(docker_password, "infra/data/ci/grafanaci-docker-hub", "password"),
        vault_secret(
            gcp_upload_artifacts_key,
            "infra/data/ci/grafana/releng/artifacts-uploader-service-account",
            "credentials.json",
        ),
        vault_secret(
            gcp_download_build_container_assets_key,
            "infra/data/ci/grafana/assets-downloader-build-container-service-account",
            "credentials.json",
        ),
        vault_secret(
            azure_sp_app_id,
            "infra/data/ci/datasources/cpp-azure-resourcemanager-credentials",
            "application_id",
        ),
        vault_secret(
            azure_sp_app_pw,
            "infra/data/ci/datasources/cpp-azure-resourcemanager-credentials",
            "application_secret",
        ),
        vault_secret(
            azure_tenant,
            "infra/data/ci/datasources/cpp-azure-resourcemanager-credentials",
            "tenant_id",
        ),
        vault_secret(
            npm_token,
            "infra/data/ci/grafana-release-eng/npm",
            "token",
        ),
        # Package publishing
        vault_secret(
            "packages_gpg_public_key",
            "infra/data/ci/packages-publish/gpg",
            "public-key-b64",
        ),
        vault_secret(
            "packages_gpg_private_key",
            "infra/data/ci/packages-publish/gpg",
            "private-key-b64",
        ),
        vault_secret(
            "packages_gpg_passphrase",
            "infra/data/ci/packages-publish/gpg",
            "passphrase",
        ),
        vault_secret(
            "packages_service_account",
            "infra/data/ci/packages-publish/service-account",
            "credentials.json",
        ),
        vault_secret(
            "packages_access_key_id",
            "infra/data/ci/packages-publish/bucket-credentials",
            "AccessID",
        ),
        vault_secret(
            "packages_secret_access_key",
            "infra/data/ci/packages-publish/bucket-credentials",
            "Secret",
        ),
        vault_secret(
            "static_asset_editions",
            "infra/data/ci/grafana-release-eng/artifact-publishing",
            "static_asset_editions",
        ),
        vault_secret(
            rgm_gcp_key_base64,
            "infra/data/ci/grafana-release-eng/rgm",
            "gcp_service_account_prod_base64",
        ),
        vault_secret(
            rgm_destination,
            "infra/data/ci/grafana-release-eng/rgm",
            "destination_prod",
        ),
        vault_secret(
            rgm_storybook_destination,
            "infra/data/ci/grafana-release-eng/rgm",
            "storybook_destination",
        ),
        vault_secret(
            rgm_cdn_destination,
            "infra/data/ci/grafana-release-eng/rgm",
            "cdn_destination",
        ),
        vault_secret(
            rgm_downloads_destination,
            "infra/data/ci/grafana-release-eng/rgm",
            "downloads_destination",
        ),
        vault_secret(
            rgm_dagger_token,
            "infra/data/ci/grafana-release-eng/rgm",
            "dagger_token",
        ),
        # grafana-delivery-bot secrets
        vault_secret(
            "delivery-bot-app-id",
            "infra/data/ci/grafana-release-eng/grafana-delivery-bot",
            "app-id",
        ),
        vault_secret(
            "delivery-bot-app-installation-id",
            "infra/data/ci/grafana-release-eng/grafana-delivery-bot",
            "app-installation-id",
        ),
        vault_secret(
            "delivery-bot-app-private-key",
            "infra/data/ci/grafana-release-eng/grafana-delivery-bot",
            "app-private-key",
        ),
        vault_secret(
            "gcr_credentials",
            "secret/data/common/gcr",
            "service-account",
        ),
    ]
