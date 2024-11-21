"""
This module is used to interface with the GitHub App to extract temporary installation tokens.
"""

load(
    "scripts/drone/utils/images.star",
    "images",
)
load(
    "scripts/drone/vault.star",
    "from_secret",
    "github_app_app_id",
    "github_app_app_installation_id",
    "github_app_private_key",
)

def github_app_generate_token_step():
    return {
        "name": "github-app-generate-token",
        "image": images["github_app_secret_writer"],
        "environment": {
            "GITHUB_APP_ID": from_secret(github_app_app_id),
            "GITHUB_APP_INSTALLATION_ID": from_secret(github_app_app_installation_id),
            "GITHUB_APP_PRIVATE_KEY": from_secret(github_app_private_key),
        },
        "commands": [
            "echo $(/usr/bin/github-app-external-token) > ./.github/token",
        ],
        "volumes": [{"name": "github-app", "path": "/github-app"}],
    }
