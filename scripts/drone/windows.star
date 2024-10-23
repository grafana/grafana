"""
This module is a library of Drone steps that exclusively run on windows machines.
"""

load(
    "scripts/drone/steps/lib.star",
    "download_grabpl_step",
)
load(
    "scripts/drone/utils/images.star",
    "images",
)
load(
    "scripts/drone/utils/utils.star",
    "pipeline",
)
load(
    "scripts/drone/vault.star",
    "from_secret",
    "rgm_gcp_key_base64",
)

def download_nssm_step():
    return {
        "name": "downlad-nssm",
        "image": images["curl"],
        "commands": [
            # We don't need to extract nssm-2.24 because the wix / build process extracts it. It just needs to be in
            # PWD and be named `nssm-2.24`.
            "curl -L0 https://nssm.cc/release/nssm-2.24.zip -o nssm-2.24.zip",
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

def download_zip_step(target = ""):
    path = "{}/grafana-$${{DRONE_TAG:1}}.windows-amd64.zip".format(target)
    return {
        "name": "download-zip",
        "image": images["cloudsdk"],
        "commands": [
            "printenv GCP_KEY | base64 -d > /tmp/key.json",
            "gcloud auth activate-service-account --key-file=/tmp/key.json",
            "bash -c 'gcloud storage cp {} grafana.zip'".format(path),
        ],
        "environment": {
            "GCP_KEY": from_secret(rgm_gcp_key_base64),
        },
    }

def windows_msi_pipeline(target = "", name = "", trigger = {}, depends_on = [], environment = {}):
    """windows_msi_pipeline is a pipeline which creates an MSI from a .zip file.

    Args:
      target: GCS path (with gs:// scheme) to the oflder containing the zip file
      name: Name of the pipeline, should be unique.
      trigger: The conditions which trigger the pipeline
      depends_on: dependencies (strings)
      environment: map of environment variables
    Returns:
        Drone step.
    """
    nssm = download_nssm_step()
    wix = download_wix_step()
    grabpl = download_grabpl_step()
    zip = download_zip_step(target = target)
    build = build_msi_step(
        depends_on = [
            nssm["name"],
            wix["name"],
            grabpl["name"],
            zip["name"],
        ],
    )
    upload = upload_msi_step(
        depends_on = [
            build["name"],
        ],
        target = target,
    )

    return pipeline(
        name = name,
        steps = [
            nssm,
            wix,
            zip,
            grabpl,
            build,
            upload,
        ],
        trigger = trigger,
        depends_on = depends_on,
        environment = environment,
    )

def windows_pipeline_release(name = "prerelease-windows-msi", depends_on = [], trigger = {}, environment = {}):
    target = "gs://grafana-prerelease/artifacts/downloads/$${DRONE_TAG}/oss/release"
    return windows_msi_pipeline(name = name, target = target, depends_on = depends_on, trigger = trigger, environment = environment)

def windows_pipeline_main(depends_on = [], trigger = {}, environment = {}):
    target = "gs://grafana-downloads/oss/main"
    return windows_msi_pipeline(name = "main-windows-msi", target = target, depends_on = depends_on, trigger = trigger, environment = environment)

def upload_msi_step(depends_on = [], target = ""):
    return {
        "name": "upload-msi-installer",
        "image": images["cloudsdk"],
        "commands": [
            "printenv GCP_KEY | base64 -d > /tmp/key.json",
            "gcloud auth activate-service-account --key-file=/tmp/key.json",
            "bash -c 'gcloud storage cp *.msi {}'".format(target),
            "bash -c 'gcloud storage cp *.msi.sha256 {}'".format(target),
        ],
        "depends_on": depends_on,
        "environment": {
            "GCP_KEY": from_secret(rgm_gcp_key_base64),
        },
    }

def build_msi_step(depends_on = []):
    return {
        "name": "build-msi",
        "image": images["wine"],
        "entrypoint": ["/bin/bash"],
        "commands": [
            "export WINEPATH=$(winepath ./wix3)",
            "./bin/grabpl windows-installer --target grafana.zip --edition oss",
        ],
        "depends_on": depends_on,
    }

def windows_manual_pipeline():
    return windows_pipeline_release(
        name = "windows-pipeline-manual",
        trigger = {
            "event": ["promote"],
            "target": "build-msi",
        },
    )
