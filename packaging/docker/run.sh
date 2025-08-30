#!/bin/sh

set -e

PERMISSIONS_OK=0

if [ ! -r "$GF_PATHS_CONFIG" ]; then
    echo "GF_PATHS_CONFIG='$GF_PATHS_CONFIG' is not readable."
    PERMISSIONS_OK=1
fi

if [ ! -w "$GF_PATHS_DATA" ]; then
    echo "GF_PATHS_DATA='$GF_PATHS_DATA' is not writable."
    PERMISSIONS_OK=1
fi

if [ ! -r "$GF_PATHS_HOME" ]; then
    echo "GF_PATHS_HOME='$GF_PATHS_HOME' is not readable."
    PERMISSIONS_OK=1
fi

if [ $PERMISSIONS_OK -eq 1 ]; then
    echo "You may have issues with file permissions, more information here: http://docs.grafana.org/installation/docker/#migrate-to-v51-or-later"
fi

if [ ! -d "$GF_PATHS_PLUGINS" ]; then
    mkdir "$GF_PATHS_PLUGINS"
fi

if [ ! -z ${GF_AWS_PROFILES+x} ]; then
    > "$GF_PATHS_HOME/.aws/credentials"

    for profile in ${GF_AWS_PROFILES}; do
        access_key_varname="GF_AWS_${profile}_ACCESS_KEY_ID"
        secret_key_varname="GF_AWS_${profile}_SECRET_ACCESS_KEY"
        region_varname="GF_AWS_${profile}_REGION"

        eval access_key="\$$access_key_varname"
        eval secret_key="\$$secret_key_varname"
        if [ ! -z "${access_key}" -a ! -z "${secret_key}" ]; then
            echo "[${profile}]" >> "$GF_PATHS_HOME/.aws/credentials"
            echo "aws_access_key_id = ${access_key}" >> "$GF_PATHS_HOME/.aws/credentials"
            echo "aws_secret_access_key = ${secret_key}" >> "$GF_PATHS_HOME/.aws/credentials"

            eval region="\$$region_varname"
            if [ ! -z "${region}" ]; then
                echo "region = ${region}" >> "$GF_PATHS_HOME/.aws/credentials"
            fi
        fi
    done

    chmod 600 "$GF_PATHS_HOME/.aws/credentials"
fi

# Convert all environment variables with names ending in __FILE into the content of
# the file that they point at and use the name without the trailing __FILE.
# This can be used to carry in Docker secrets.
for VAR_NAME in $(env | grep '^GF_[^=]\+__FILE=.\+' | sed -r "s/([^=]*)__FILE=.*/\1/g"); do
    VAR_NAME_FILE="$VAR_NAME"__FILE
    eval VAR="\$$VAR_NAME"
    if [ "${VAR}" ]; then
        echo >&2 "ERROR: Both $VAR_NAME and $VAR_NAME_FILE are set (but are exclusive)"
        exit 1
    fi
    eval FILE="\$$VAR_NAME_FILE"
    echo "Getting secret $VAR_NAME from ${FILE}"
    export "$VAR_NAME"="$(cat "${FILE}")"
    unset "$VAR_NAME_FILE"
done

export HOME="$GF_PATHS_HOME"

if [ ! -z "${GF_INSTALL_PLUGINS}" ]; then
  >&2 echo "\033[0;33mWARN\033[0m: GF_INSTALL_PLUGINS is deprecated. Use GF_PLUGINS_PREINSTALL or GF_PLUGINS_PREINSTALL_SYNC instead. Checkout the documentation for more info."
  if [ "${GF_INSTALL_PLUGINS_FORCE}" = "true" ]; then
    OLDIFS=$IFS
    IFS=','
    for plugin in ${GF_INSTALL_PLUGINS}; do
        IFS=$OLDIFS
        if [[ $plugin =~ .*\;.* ]]; then
            pluginUrl=$(echo "$plugin" | cut -d';' -f 1)
            pluginInstallFolder=$(echo "$plugin" | cut -d';' -f 2)
            grafana cli --pluginUrl ${pluginUrl} --pluginsDir "${GF_PATHS_PLUGINS}" plugins install "${pluginInstallFolder}"
        else
            grafana cli --pluginsDir "${GF_PATHS_PLUGINS}" plugins install ${plugin}
        fi
    done
  fi
fi

exec grafana server                                         \
  --homepath="$GF_PATHS_HOME"                               \
  --config="$GF_PATHS_CONFIG"                               \
  --packaging=docker                                        \
  "$@"                                                      \
  cfg:default.log.mode="console"                            \
  cfg:default.paths.data="$GF_PATHS_DATA"                   \
  cfg:default.paths.logs="$GF_PATHS_LOGS"                   \
  cfg:default.paths.plugins="$GF_PATHS_PLUGINS"             \
  cfg:default.paths.provisioning="$GF_PATHS_PROVISIONING"
