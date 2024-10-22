"""
This module is a library of Drone steps that exclusively run on windows machines.
"""

load(
    "scripts/drone/utils/windows_images.star",
    "windows_images",
)
load(
    "scripts/drone/variables.star",
    "grabpl_version",
)
load(
    "scripts/drone/vault.star",
    "from_secret",
    "gcp_grafanauploads_base64",
    "prerelease_bucket",
)

def get_windows_steps_release():
    target = "gs://grafana-prerelease/artifacts/downloads/${DRONE_TAG:1}/oss/release"
    return [
        build_msi_step(depends_on=[], target=target),
    ]

def get_windows_steps_main():
    """Generate the list of Windows steps.

    Args:

    Returns:
      List of Drone steps which will build and upload a Grafana MSI package from a Grafana zip
    """

    target = "gs://grafana-downloads/oss/main/grafana-$${DRONE_TAG:1}.windows-amd64.zip"
    return [
        build_msi_step(depends_on=[], target=target),
    ]

def upload_msi_step_main(target=""):
    return {
        "commands": [
            "gsutil cp *msi gs://{}/oss/{}/".format(gcp_bucket, dir),
            'gsutil cp "*msi.sha256" gs://{}/oss/{}/'.format(
                gcp_bucket,
                dir,
            ),
        ],
    }

def upload_msi_step_release(target=""):
    return {
        "commands": [
            "gsutil cp $$fname gs://{}/{}/oss/{}/".format(
                gcp_bucket,
                ver_part,
                dir,
            ),
            'gsutil cp "$$fname.sha256" gs://{}/{}/oss/{}/'.format(
                gcp_bucket,
                ver_part,
                dir,
            ),
        ],
    }

    return steps

def build_msi_step(depends_on=[], target=""):
    return {
        "commands": [
            "grabpl windows-installer --target {} --edition oss {}".format("gs://{}/{}/oss/{}/grafana-{}.windows-amd64.zip".format(gcp_bucket, ver_part, ver_mode, version),
        ]
        "environment": {
            "GCP_KEY": from_secret(gcp_grafanauploads_base64),
            "PRERELEASE_BUCKET": from_secret(prerelease_bucket),
            "GITHUB_TOKEN": from_secret("github_token"),
        },
    }
