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

def identify_runner_step_windows():
    return {
        "name": "identify-runner",
        "image": windows_images["1809"],
        "commands": [
            "echo $env:DRONE_RUNNER_NAME",
        ],
    }

def get_windows_steps(ver_mode, bucket = "%PRERELEASE_BUCKET%"):
    """Generate the list of Windows steps.

    Args:
      ver_mode: used to differentiate steps for different version modes.
      bucket: used to override prerelease bucket.

    Returns:
      List of Drone steps.
    """
    steps = [
        identify_runner_step_windows(),
    ]

    init_cmds = [
        '$$ProgressPreference = "SilentlyContinue"',
        "Invoke-WebRequest https://grafana-downloads.storage.googleapis.com/grafana-build-pipeline/{}/windows/grabpl.exe -OutFile grabpl.exe".format(
            grabpl_version,
        ),
    ]

    steps.extend(
        [
            {
                "name": "windows-init",
                "image": windows_images["wix"],
                "commands": init_cmds,
            },
        ],
    )

    if ver_mode in (
        "release",
        "release-branch",
    ):
        gcp_bucket = "{}/artifacts/downloads".format(bucket)
        if ver_mode == "release":
            ver_part = "${DRONE_TAG}"
            dir = "release"
        else:
            dir = "main"
            gcp_bucket = "grafana-downloads"
            build_no = "DRONE_BUILD_NUMBER"
            ver_part = "--build-id $$env:{}".format(build_no)
        installer_commands = [
            "$$gcpKey = $$env:GCP_KEY",
            "[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($$gcpKey)) > gcpkey.json",
            # gcloud fails to read the file unless converted with dos2unix
            "dos2unix gcpkey.json",
            "gcloud auth activate-service-account --key-file=gcpkey.json",
            "rm gcpkey.json",
            "cp C:\\App\\nssm-2.24.zip .",
        ]

        if ver_mode in ("release",):
            version = "${DRONE_TAG:1}"
            installer_commands.extend(
                [
                    ".\\grabpl.exe windows-installer --target {} --edition oss {}".format(
                        "gs://{}/{}/oss/{}/grafana-{}.windows-amd64.zip".format(gcp_bucket, ver_part, ver_mode, version),
                        ver_part,
                    ),
                    '$$fname = ((Get-Childitem grafana*.msi -name) -split "`n")[0]',
                ],
            )
            if ver_mode == "main":
                installer_commands.extend(
                    [
                        "gsutil cp $$fname gs://{}/oss/{}/".format(gcp_bucket, dir),
                        'gsutil cp "$$fname.sha256" gs://{}/oss/{}/'.format(
                            gcp_bucket,
                            dir,
                        ),
                    ],
                )
            else:
                installer_commands.extend(
                    [
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
                )
        steps.append(
            {
                "name": "build-windows-installer",
                "image": windows_images["wix"],
                "depends_on": [
                    "windows-init",
                ],
                "environment": {
                    "GCP_KEY": from_secret(gcp_grafanauploads_base64),
                    "PRERELEASE_BUCKET": from_secret(prerelease_bucket),
                    "GITHUB_TOKEN": from_secret("github_token"),
                },
                "commands": installer_commands,
            },
        )

    return steps

def download_grabpl_step_windows():
    return {
        "name": "grabpl",
        "image": windows_images["wix"],
        "commands": [
            '$$ProgressPreference = "SilentlyContinue"',
            "Invoke-WebRequest https://grafana-downloads.storage.googleapis.com/grafana-build-pipeline/{}/windows/grabpl.exe -OutFile grabpl.exe".format(
                grabpl_version,
            ),
        ],
    }

def test_backend_step_windows():
    # TODO: This is mostly a duplicate of "test_backend_step" in lib.star; but this file can't import that one,
    # otherwise it creates an import cycle.
    return {
        "name": "test-backend",
        "image": windows_images["go"],
        "depends_on": [
            "wire-install",
        ],
        "commands": [
            "go test -tags requires_buildifer -short -covermode=atomic -timeout=5m ./pkg/...",
        ],
    }


def clone_step_windows():
    return {
        "name": "clone",
        "image": windows_images["wix"],
        "environment": {
            "GITHUB_TOKEN": from_secret("github_token"),
        },
        "commands": [
            'git clone "https://$$env:GITHUB_TOKEN@github.com/$$env:DRONE_REPO.git" .',
            "git checkout -f $$env:DRONE_COMMIT",
        ],
    }

def wire_install_step_windows(edition):
    return {
        "name": "wire-install",
        "image": windows_images["go"],
        "commands": [
            "go install github.com/google/wire/cmd/wire@v0.5.0",
            "wire gen -tags {} ./pkg/server".format(edition),
        ],
        "depends_on": [
            "windows-init",
        ],
    }
