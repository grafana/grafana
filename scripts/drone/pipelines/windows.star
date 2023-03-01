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
)

def windows(trigger, edition, ver_mode):
    """Generates the pipeline used for building Grafana on Windows.

    Args:
      trigger: a Drone trigger for the pipeline.
      edition: controls whether enterprise code is included in the pipeline steps.
      ver_mode: controls whether a pre-release or actual release pipeline is generated.
        Also indirectly controls which version of enterprise code is used.

    Returns:
      Drone pipeline.
    """
    environment = {"EDITION": edition}

    return pipeline(
        name = "main-windows",
        edition = edition,
        trigger = dict(trigger, repo = ["grafana/grafana"]),
        steps = get_windows_steps(edition, ver_mode),
        depends_on = [
            "main-test-frontend",
            "main-test-backend",
            "main-build-e2e-publish",
            "main-integration-tests",
        ],
        platform = "windows",
        environment = environment,
    )
