"""
rgm uses 'github.com/grafana/grafana-build' to build Grafana on the following events:
* A merge to main
* A tag that begins with a 'v'
"""

load(
    "scripts/drone/utils/utils.star",
    "pipeline",
)

def rgm_build(distros=["linux/amd64", "linux/arm64"]):
  clone_step = {
    "name": "clone-rgm",
    "image": "alpine/git",
    "commands": [
      "git clone https://github.com/grafana/grafana-build.git rgm",
    ],
    "failure": "ignore",
  }

  rgm_build_step = {
    "name": "rgm-build",
    "image": "golang:1.20.3-alpine",
    "commands": [
      # the docker program is a requirement for running dagger programs
      "apk update && apk add docker",
      "go run ./rgm/cmd --help",
    ],
    # The docker socket is a requirement for running dagger programs
    # In the future we should find a way to use dagger without mounting the docker socket.
    "volumes": [{"name": "docker", "path": "/var/run/docker.sock"}],
    "failure": "ignore",
  }

  return [
    clone_step,
    rgm_build_step,
  ]

def rgm_main():
  trigger = {
      "event": [
          "push",
      ],
      "branch": "add-rgm-to-drone",
  }

  return pipeline(
    name="rgm-main-build",
    edition="all",
    trigger=trigger,
    steps=rgm_build(),
  )

def rgm_tag():
  trigger = {
      "event": {
          "exclude": [
              "promote",
          ],
      },
      "ref": {
          "include": [
              "refs/tags/v*",
          ],
          "exclude": [
              "refs/tags/*-cloud*",
          ],
      },
  }

  return pipeline(
    name="rgm-tag-build",
    edition="all",
    trigger=trigger,
    steps=rgm_build(),
  )

def rgm():
  return [
    rgm_main(),
    rgm_tag(),
  ]
