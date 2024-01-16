"""
This module contains all the windows docker images that are used to build test and publish Grafana.
All the windows images needed to be in a different file than the other images, since they cannot be scanned
by trivy. Related issue: https://github.com/aquasecurity/trivy/issues/1392
"""

load(
    "scripts/drone/variables.star",
    "golang_version",
)

windows_images = {
    "1809": "mcr.microsoft.com/windows:1809",
    "wix": "grafana/ci-wix:0.1.1",
    "windows_server_core": "docker:windowsservercore-1809",
    "go": "golang:{}-windowsservercore-1809".format(golang_version),
}
