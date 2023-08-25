"""
This module contains all the windows docker images that are used to build test and publish Grafana.
All the windows images needed to be in a different file than the other images, since they cannot be scanned
by trivy. Related issue: https://github.com/aquasecurity/trivy/issues/1392
"""

windows_images = {
    "1809_image": "mcr.microsoft.com/windows:1809",
    "wix_image": "grafana/ci-wix:0.1.1",
    "windows_server_core_image": "docker:windowsservercore-1809",
    "windows_go_image": "grafana/grafana-ci-windows-test:0.1.0",
}
