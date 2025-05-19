"""
Utilities / functions for working with dagger pipelines
"""

def with_dagger_install(commands=[], dagger_version=""):
    return [
        "wget https://github.com/dagger/dagger/releases/download/{}/dagger_{}_linux_amd64.tar.gz /tmp".format(dagger_version, dagger_version),
        "tar zxf /tmp/dagger*.tar.gz",
        "mv /tmp/dagger /bin/dagger",
    ] + commands
