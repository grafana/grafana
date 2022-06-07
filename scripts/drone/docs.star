def build_documentation_pipeline():
  return {
    "kind": "pipeline",
    "type": "docker",
    "name": "build-documentation",
    "steps": [
      builtin_compile_pipeline_step(),
      download_grabpl_step(),
      codespell_step(),
      lint_docs_step(),
      build_frontend_package_step(),
      build_frontend_documentation_step(),
      build_documentation_website_step(),
    ],
    "volumes": [
      {
        "name": "scribe",
        "temp": {
        },
      },
      {
        "name": "scribe-state",
        "temp": {
        },
      },
      {
        "name": "docker-socket",
        "host": {
          "path": "/var/run/docker.sock",
        },
      },
    ],
  }

def builtin_compile_pipeline_step():
  return {
    "command": [
      "go",
      "build",
      "-o",
      "/var/scribe/pipeline",
      ".",
    ],
    "environment": {
      "GOOS": "linux",
      "GOARCH": "amd64",
      "CGO_ENABLED": "0",
    },
    "image": "grafana/scribe:go-latest",
    "name": "builtin-compile-pipeline",
    "volumes": [
      {
        "name": "scribe",
        "path": "/var/scribe",
      },
    ],
  }

def download_grabpl_step():
  return {
    "commands": [
      "/var/scribe/pipeline -step=1 -build-id=$DRONE_BUILD_NUMBER -state=file:///var/scribe-state/state.json .",
    ],
    "depends_on": [
      "builtin-compile-pipeline",
    ],
    "image": "grafana/scribe:latest",
    "name": "download-grabpl",
    "volumes": [
      {
        "name": "scribe",
        "path": "/var/scribe",
      },
      {
        "name": "scribe-state",
        "path": "/var/scribe-state",
      },
    ],
  }

def codespell_step():
  return {
    "commands": [
      "/var/scribe/pipeline -step=3 -build-id=$DRONE_BUILD_NUMBER -state=file:///var/scribe-state/state.json .",
    ],
    "depends_on": [
      "download-grabpl",
    ],
    "image": "grafana/build-container:1.5.3",
    "name": "codespell",
    "volumes": [
      {
        "name": "scribe",
        "path": "/var/scribe",
      },
      {
        "name": "scribe-state",
        "path": "/var/scribe-state",
      },
    ],
  }

def lint_docs_step():
  return {
    "commands": [
      "/var/scribe/pipeline -step=4 -arg=workdir=$DRONE_REPO_NAME -build-id=$DRONE_BUILD_NUMBER -state=file:///var/scribe-state/state.json .",
    ],
    "depends_on": [
      "download-grabpl",
    ],
    "image": "grafana/build-container:1.5.3",
    "name": "lint-docs",
    "volumes": [
      {
        "name": "scribe",
        "path": "/var/scribe",
      },
      {
        "name": "scribe-state",
        "path": "/var/scribe-state",
      },
    ],
  }

def build_frontend_package_step():
  return {
    "commands": [
      "/var/scribe/pipeline -step=6 -arg=github_token=$secret-github_token -arg=workdir=$DRONE_REPO_NAME -build-id=$DRONE_BUILD_NUMBER -state=file:///var/scribe-state/state.json .",
    ],
    "depends_on": [
      "codespell",
      "lint-docs",
    ],
    "environment": {
      "$secret-github_token": "",
    },
    "image": "grafana/build-container:1.5.3",
    "name": "build-frontend-package",
    "volumes": [
      {
        "name": "scribe",
        "path": "/var/scribe",
      },
      {
        "name": "scribe-state",
        "path": "/var/scribe-state",
      },
    ],
  }

def build_frontend_documentation_step():
  return {
    "commands": [
      "/var/scribe/pipeline -step=7 -build-id=$DRONE_BUILD_NUMBER -state=file:///var/scribe-state/state.json .",
    ],
    "depends_on": [
      "build-frontend-package",
    ],
    "image": "grafana/build-container:1.5.3",
    "name": "build-frontend-documentation",
    "volumes": [
      {
        "name": "scribe",
        "path": "/var/scribe",
      },
      {
        "name": "scribe-state",
        "path": "/var/scribe-state",
      },
    ],
  }

def build_documentation_website_step():
  return {
    "commands": [
      "/var/scribe/pipeline -step=8 -build-id=$DRONE_BUILD_NUMBER -state=file:///var/scribe-state/state.json .",
    ],
    "depends_on": [
      "build-frontend-documentation",
    ],
    "image": "grafana/scribe:latest",
    "name": "build-documentation-website",
    "volumes": [
      {
        "name": "scribe",
        "path": "/var/scribe",
      },
      {
        "name": "scribe-state",
        "path": "/var/scribe-state",
      },
    ],
  }

