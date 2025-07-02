"""
Individual steps that use 'grafana-build' to replace existing individual steps.
These aren't used in releases.
"""

load(
    "scripts/drone/dagger.star",
    "with_dagger_install",
)
load(
    "scripts/drone/utils/images.star",
    "images",
)
load(
    "scripts/drone/variables.star",
    "dagger_version",
)
load(
    "scripts/drone/vault.star",
    "from_secret",
    "rgm_dagger_token",
)

def artifacts_cmd(artifacts = []):
    cmd = "go run ./pkg/build/cmd artifacts "

    for artifact in artifacts:
        cmd += "-a {} ".format(artifact)

    return cmd

# rgm_artifacts_step will create artifacts using the '/src/build artifacts' command.
def rgm_artifacts_step(
        name = "rgm-package",
        artifacts = ["targz:grafana:linux/amd64", "targz:grafana:linux/arm64"],
        file = "packages.txt",
        depends_on = ["yarn-install"],
        tag_format = "{{ .version }}-{{ .arch }}",
        ubuntu_tag_format = "{{ .version }}-ubuntu-{{ .arch }}",
        verify = "false"):
    cmd = artifacts_cmd(artifacts = artifacts)

    return {
        "name": name,
        "image": images["go"],
        "pull": "always",
        "depends_on": depends_on,
        "environment": {
            "_EXPERIMENTAL_DAGGER_CLOUD_TOKEN": from_secret(rgm_dagger_token),
        },
        "commands": with_dagger_install([
            "docker run --privileged --rm tonistiigi/binfmt:qemu-v7.0.0-28 --version",
            "docker run --privileged --rm tonistiigi/binfmt:qemu-v7.0.0-28 --uninstall 'qemu-*'",
            "docker run --privileged --rm tonistiigi/binfmt:qemu-v7.0.0-28 --install all",
            cmd +
            "--yarn-cache=$$YARN_CACHE_FOLDER " +
            "--build-id=$$DRONE_BUILD_NUMBER " +
            "--ubuntu-base=ubuntu-base " +
            "--alpine-base=alpine-base " +
            "--tag-format='{}' ".format(tag_format) +
            "--ubuntu-tag-format='{}' ".format(ubuntu_tag_format) +
            "--verify='{}' ".format(verify) +
            "--grafana-dir=$$PWD > {}".format(file),
            "find ./dist -name '*docker*.tar.gz' -type f | xargs -n1 docker load -i",
        ], dagger_version),
        "volumes": [{"name": "docker", "path": "/var/run/docker.sock"}],
    }

# rgm_build_backend will create compile the grafana backend for various platforms.
def rgm_build_backend_step(artifacts = ["backend:grafana:linux/amd64", "backend:grafana:linux/arm64"]):
    return rgm_artifacts_step(name = "rgm-build-backend", artifacts = artifacts, depends_on = [])

def rgm_build_docker_step(depends_on = ["yarn-install"], file = "docker.txt", tag_format = "{{ .version }}-{{ .arch }}", ubuntu_tag_format = "{{ .version }}-ubuntu-{{ .arch }}"):
    return {
        "name": "rgm-build-docker",
        "image": images["go"],
        "pull": "always",
        "environment": {
            "_EXPERIMENTAL_DAGGER_CLOUD_TOKEN": from_secret(rgm_dagger_token),
        },
        "commands": with_dagger_install([
            "docker run --privileged --rm tonistiigi/binfmt:qemu-v7.0.0-28 --version",
            "docker run --privileged --rm tonistiigi/binfmt:qemu-v7.0.0-28 --uninstall 'qemu-*'",
            "docker run --privileged --rm tonistiigi/binfmt:qemu-v7.0.0-28 --install all",
            "go run ./pkg/build/cmd artifacts " +
            "-a docker:grafana:linux/amd64 " +
            "-a docker:grafana:linux/amd64:ubuntu " +
            "-a docker:grafana:linux/arm64 " +
            "-a docker:grafana:linux/arm64:ubuntu " +
            "-a docker:grafana:linux/arm/v7 " +
            "-a docker:grafana:linux/arm/v7:ubuntu " +
            "--yarn-cache=$$YARN_CACHE_FOLDER " +
            "--build-id=$$DRONE_BUILD_NUMBER " +
            "--ubuntu-base=ubuntu-base " +
            "--alpine-base=alpine-base " +
            "--tag-format='{}' ".format(tag_format) +
            "--grafana-dir=$$PWD " +
            "--ubuntu-tag-format='{}' > {}".format(ubuntu_tag_format, file),
            "find ./dist -name '*docker*.tar.gz' -type f | xargs -n1 docker load -i",
        ], dagger_version),
        "volumes": [{"name": "docker", "path": "/var/run/docker.sock"}],
        "depends_on": depends_on,
    }
