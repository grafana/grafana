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

def download_nssm_step():
def download_wix_step():
def download_grabpl_step():

def windows_pipeline_release():
    target = "gs://grafana-prerelease/artifacts/downloads/${DRONE_TAG:1}/oss/release"
    return {
        name="prerelease-windows-msi",
        steps=[
            download_nssm_step(),
            download_wix_step(),
            build_msi_step(depends_on=[], target=target),
        ]
    }

def windows_pipeline_main(depends_on=[]):
    """Generate the list of Windows steps.

    Args:

    Returns:
      List of Drone steps which will build and upload a Grafana MSI package from a Grafana zip
    """

    target = "gs://grafana-downloads/oss/main/grafana-$${DRONE_TAG:1}.windows-amd64.zip"
    return {
        name="main-windows-msi",
        steps=[
            build_msi_step(depends_on=[], target=target),
        ],
        "depends_on": depends_on,
    }

def upload_msi_step(depends_on=[], target=""):
    return {
        "commands": [
            "gsutil cp *.msi {}".format(target),
            'gsutil cp *.msi.sha256 {}'.format(target)
        ],
        "depends_on": depends_on,
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
        "depends_on": depends_on,
    }
