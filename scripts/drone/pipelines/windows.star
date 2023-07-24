"""
This module returns the pipeline used for building Grafana on Windows.
"""

load(
    "scripts/drone/utils/utils.star",
    "pipeline",
)
load(
    "scripts/drone/steps/lib.star",
    "get_windows_steps",
    "windows_clone_step",
    "windows_test_backend_step",
    "windows_wire_install_step",
)
load(
    "scripts/drone/utils/windows_images.star",
    "windows_images",
)

def windows_test_backend(trigger, edition, ver_mode):
    """ Generates a pipeline that runs backend tests on Windows

    Args:
      trigger: a Drone trigger for the pipeline
      edition: controls whether enterprise code is included or not
      ver_mode: controls whether a pre-release or actual release pipeline is generated.
    Returns:
        A single pipeline running backend tests for Windows
    """
    environment = {"EDITION": edition}
    steps = [
        windows_clone_step(),
    ]

    steps.extend([{
        "name": "windows-init",
        "image": windows_images["windows_go_image"],
        "depends_on": ["clone"],
        "commands": [],
    }])

    steps.extend([
        windows_wire_install_step(edition),
        windows_test_backend_step(),
    ])
    pl = pipeline(
        name = "{}-test-backend-windows".format(ver_mode),
        trigger = trigger,
        steps = steps,
        depends_on = [],
        platform = "windows",
        environment = environment,
    )
    pl["clone"] = {
        "disable": True,
    }
    return pl

def windows(trigger, ver_mode):
    """Generates the pipeline used for building Grafana on Windows.

    Args:
      trigger: a Drone trigger for the pipeline.
      ver_mode: controls whether a pre-release or actual release pipeline is generated.
        Also indirectly controls which version of enterprise code is used.

    Returns:
      Drone pipeline.
    """
    environment = {"EDITION": "oss"}

    return pipeline(
        name = "main-windows",
        trigger = dict(trigger, repo = ["grafana/grafana"]),
        steps = get_windows_steps(ver_mode),
        depends_on = [
            "main-test-frontend",
            "main-test-backend",
            "main-build-e2e-publish",
            "main-integration-tests",
        ],
        platform = "windows",
        environment = environment,
    )
