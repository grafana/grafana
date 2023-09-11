# rgm_package_step will create a tar.gz for use in e2e tests or other PR testing related activities..
def rgm_package_step(distros = "linux/amd64,linux/arm64", file = "packages.txt"):
    return {
        "name": "rgm-package",
        "image": "grafana/grafana-build:main",
        "commands": [
            "/src/grafana-build package --distro={} --grafana-dir=$$PWD > {}".format(distros, file),
        ],
        "volumes": [{"name": "docker", "path": "/var/run/docker.sock"}],
    }

# rgm_build_backend will create compile the grafana backend for various platforms. It's preferred to use
# 'rgm_package_step' if you creating a "usable" artifact. This should really only be used to verify that the code is
# compilable.
def rgm_build_backend_step(distros = "linux/amd64,linux/arm64"):
    return {
        "name": "rgm-package",
        "image": "grafana/grafana-build:main",
        "commands": [
            "/src/grafana-build build --distro={} --grafana-dir=$$PWD".format(distros),
        ],
        "volumes": [{"name": "docker", "path": "/var/run/docker.sock"}],
    }

def rgm_build_docker_step(packages, ubuntu, alpine):
    return {
        "name": "rgm-build-docker",
        "image": "grafana/grafana-build:main",
        "commands": [
            "/src/grafana-build docker --package=$(cat {} | grep tar.gz | grep -v docker | grep -v sha256) --ubuntu-base={} --alpine-base={}".format(packages, ubuntu, alpine),
        ],
        "volumes": [{"name": "docker", "path": "/var/run/docker.sock"}],
    }
