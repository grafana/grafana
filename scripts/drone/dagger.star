"""
Utilities / functions for working with dagger pipelines
"""

def with_dagger_install(commands=[], dagger_version=""):
    return [
        "curl -s -L https://github.com/dagger/dagger/releases/download/{}/dagger_{}_linux_amd64.tar.gz | tar zx -C /bin".format(dagger_version, dagger_version),
    ] + commands
