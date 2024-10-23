"""
This module is a library of Drone steps that exclusively run on windows machines.
"""

load(
    "scripts/drone/utils/images.star",
    "images",
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
load(
    "scripts/drone/steps/lib.star",
    "download_grabpl_step",
)

load(
    "scripts/drone/utils/utils.star",
    "pipeline",
)

def download_nssm_step():
    return {
        "name": "downlad-nssm",
        "image": images["curl"],
        "commands": [
            "curl https://nssm.cc/release/nssm-2.24.zip -o nssm.zip",
            "unzip nssm.zip",
        ],
    }

def download_wix_step():
    return {
        "name": "download-wix3",
        "image": images["curl"],
        "commands": [
            "mkdir wix3 && cd wix3",
            "curl -L0 https://github.com/wixtoolset/wix3/releases/download/wix3141rtm/wix314-binaries.zip -o wix3.zip",
            "unzip wix3.zip",
        ],
    }

def windows_msi_pipeline(target="", name="", trigger={}, depends_on=[], environment=[], ):
    nssm = download_nssm_step()
    wix = download_wix_step()
    grabpl = download_grabpl_step()
    build = build_msi_step(
        depends_on=[
            nssm["name"],
            wix["name"],
            grabpl["name"],
        ],
        target=target,
    )
    upload = upload_msi_step(
        depends_on=[
            build["name"],
        ],
        target=target,
    )

    return pipeline(
        name=name,
        steps=[
            nssm,
            wix,
            grabpl,
            build,
            upload,
        ],
        trigger=trigger,
        depends_on=depends_on,
        environment=environment,
    )
def windows_pipeline_release(name="prerelease-windows-msi", depends_on=[], trigger={}, environment={}):
    target = "gs://grafana-prerelease/artifacts/downloads/${DRONE_TAG:1}/oss/release"
    return windows_msi_pipeline(name=name, target=target, depends_on=depends_on, trigger=trigger, environment=environment)

def windows_pipeline_main(depends_on=[], trigger={}, environment={}):
    target = "gs://grafana-downloads/oss/main/grafana-$${DRONE_TAG:1}.windows-amd64.zip"
    return windows_msi_pipeline(name="main-windows-msi", target=target, depends_on=depends_on, trigger=trigger, environment=environment)

def upload_msi_step(depends_on=[], target=""):
    return {
        "name": "upload-msi-installer",
        "image": images["cloudsdk"],
        "commands": [
            "printenv GCP_GRAFANA_UPLOAD_ARTIFACTS_KEY > /tmp/gcpkey_upload_artifacts.json",
            "gcloud auth activate-service-account --key-file=/tmp/gcpkey_upload_artifacts.json",
            "gsutil cp *.msi {}".format(target),
            'gsutil cp *.msi.sha256 {}'.format(target)
        ],
        "depends_on": depends_on,
        "environment": {
            "GCP_KEY": from_secret(gcp_grafanauploads_base64),
        },
    }

def build_msi_step(depends_on=[], target=""):
    path = "{}/grafana-$${{DRONE_TAG:1}}.windows-amd64.zip".format(target)
    return {
        "name": "build-and-upload-msi",
        "image": images["wine"],
        "commands": [
            "export WINEPATH=$(winepath ./wix3)",
            "printenv GCP_GRAFANA_UPLOAD_ARTIFACTS_KEY > /tmp/gcpkey_upload_artifacts.json",
            "gcloud auth activate-service-account --key-file=/tmp/gcpkey_upload_artifacts.json",
            "grabpl windows-installer --target {} --edition oss".format(path),
        ],
        "environment": {
            "GCP_KEY": from_secret(gcp_grafanauploads_base64),
            "PRERELEASE_BUCKET": from_secret(prerelease_bucket),
            "GITHUB_TOKEN": from_secret("github_token"),
        },
        "depends_on": depends_on,
    }

def windows_manual_pipeline():
    return windows_pipeline_release(
        name="windows-pipeline-manual",
        trigger={
            "event": ["promote"],
            "target": "build-msi",
        },
    )
