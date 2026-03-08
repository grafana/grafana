variable "GRAFANA_VERSION" {
  default = "dev"
}

variable "DOCKER_REPO" {
  default = "grafana/grafana"
}

variable "COMMIT_SHA" {
  default = ""
}

variable "BUILD_BRANCH" {
  default = ""
}

variable "GO_BUILD_TAGS" {
  default = "oss"
}

variable "WIRE_TAGS" {
  default = "oss"
}

variable "GO_BUILD_DEV" {
  default = ""
}

group "default" {
  targets = ["grafana"]
}

group "release" {
  targets = ["grafana-release", "grafana-ubuntu-release"]
}

target "_common" {
  dockerfile = "Dockerfile"
  context    = "."
  args = {
    COMMIT_SHA           = COMMIT_SHA
    BUILD_BRANCH         = BUILD_BRANCH
    GO_BUILD_TAGS        = GO_BUILD_TAGS
    WIRE_TAGS            = WIRE_TAGS
    JS_NODE_ENV          = GO_BUILD_DEV == "dev" ? "dev" : "production"
    JS_YARN_BUILD_FLAG   = GO_BUILD_DEV == "dev" ? "dev" : "build"
    JS_YARN_INSTALL_FLAG = GO_BUILD_DEV == "dev" ? "" : "--immutable"
  }
}

target "grafana" {
  inherits = ["_common"]
  target   = "alpine-final"
  tags = [
    "${DOCKER_REPO}:${GRAFANA_VERSION}",
    "${DOCKER_REPO}:latest",
  ]
}

target "grafana-ubuntu" {
  inherits = ["_common"]
  target   = "ubuntu-final"
  tags = [
    "${DOCKER_REPO}:${GRAFANA_VERSION}-ubuntu",
    "${DOCKER_REPO}:latest-ubuntu",
  ]
}

target "grafana-release" {
  inherits  = ["grafana"]
  platforms = ["linux/amd64", "linux/arm64", "linux/arm/v7", "linux/s390x"]
}

target "grafana-ubuntu-release" {
  inherits  = ["grafana-ubuntu"]
  platforms = ["linux/amd64", "linux/arm64", "linux/arm/v7", "linux/s390x"]
}
