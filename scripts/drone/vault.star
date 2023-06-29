"""
This module returns functions for generating Drone secrets fetched from Vault.
"""
pull_secret = "dockerconfigjson"
drone_token = "drone_token"
prerelease_bucket = "prerelease_bucket"
gcp_upload_artifacts_key = "gcp_upload_artifacts_key"
azure_sp_app_id = "azure_sp_app_id"
azure_sp_app_pw = "azure_sp_app_pw"
azure_tenant = "azure_tenant"

rgm_gcp_key_base64 = "gcp_key_base64"
rgm_destination = "destination"
rgm_github_token = "github_token"
rgm_dagger_token = "dagger_token"

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
        vault_secret(pull_secret, "secret/data/common/gcr", ".dockerconfigjson"),
        vault_secret("github_token", "infra/data/ci/github/grafanabot", "pat"),
        vault_secret(drone_token, "infra/data/ci/drone", "machine-user-token"),
        vault_secret(prerelease_bucket, "infra/data/ci/grafana/prerelease", "bucket"),
        vault_secret(
            gcp_upload_artifacts_key,
            "infra/data/ci/grafana/releng/artifacts-uploader-service-account",
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
            "aws_region",
            "secret/data/common/aws-marketplace",
            "aws_region",
        ),
        vault_secret(
            "aws_access_key_id",
            "secret/data/common/aws-marketplace",
            "aws_access_key_id",
        ),
        vault_secret(
            "aws_secret_access_key",
            "secret/data/common/aws-marketplace",
            "aws_secret_access_key",
        ),
        vault_secret(
            "static_asset_editions",
            "infra/data/ci/grafana-release-eng/artifact-publishing",
            "static_asset_editions",
        ),
        vault_secret(
            "enterprise2-cdn-path",
            "infra/data/ci/grafana-release-eng/enterprise2",
            "cdn_path",
        ),
        vault_secret(
            rgm_gcp_key_base64,
            "infra/data/ci/grafana-release-eng/rgm",
            "gcp_service_account_base64",
        ),
        vault_secret(
            rgm_destination,
            "infra/data/ci/grafana-release-eng/rgm",
            "destination",
        ),
        vault_secret(
            rgm_dagger_token,
            "infra/data/ci/grafana-release-eng/rgm",
            "dagger_token",
        ),
        vault_secret(
            rgm_github_token,
            "infra/data/ci/github/grafanabot",
            "pat",
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
    ]
