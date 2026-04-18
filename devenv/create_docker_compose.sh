#!/usr/bin/env bash

shopt -s nullglob # Enable nullglob

# Get the directory where this script is located (works from any execution directory)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

blocks_dir="${SCRIPT_DIR}/docker/blocks"
docker_dir="${SCRIPT_DIR}/docker"
template_dir="${SCRIPT_DIR}/templates"

grafana_config_file="${SCRIPT_DIR}/conf.tmp"
grafana_config=config

compose_header_file="${SCRIPT_DIR}/docker/compose_header.yml"
compose_volume_section_file="${SCRIPT_DIR}/docker/compose_volume_section.yml"
compose_volume_section_create_flag=docker_volume_create_true
compose_file="${SCRIPT_DIR}/docker-compose.yaml"
compose_file_name="docker-compose.yaml"
env_file="${SCRIPT_DIR}/.env"
env_file_name=".env"

if [ "$#" == 0 ]; then
    blocks=`ls $blocks_dir`
    if [ -z "$blocks" ]; then
        echo "No Blocks available in $blocks_dir"
    else
        echo "Available Blocks:"
        for block in $blocks; do
            echo "    $block"
        done
    fi
    exit 0
fi

for file in $grafana_config_file $compose_file $env_file; do
    if [ -e $file ]; then
        echo "Deleting $file"
        rm $file
    fi
done

echo "Adding Compose header to $compose_file"
cat $compose_header_file >> $compose_file

for dir in $@; do
    current_dir=$blocks_dir/$dir
    if [ ! -d "$current_dir" ]; then
        echo "$current_dir is not a directory"
        exit 1
    fi

    if [ -e $current_dir/$grafana_config ]; then
        echo "Adding $current_dir/$grafana_config to $grafana_config_file"
        cat $current_dir/$grafana_config >> $grafana_config_file
        echo "" >> $grafana_config_file
    fi

    if [ -e $current_dir/$compose_file_name ]; then
        echo "Adding $current_dir/$compose_file_name to $compose_file"
        cat $current_dir/$compose_file_name >> $compose_file
        echo "" >> $compose_file
    fi

    if [ -e $current_dir/$env_file_name ]; then
        echo "Adding $current_dir/$env_file_name to $env_file"
        cat $current_dir/$env_file_name >> $env_file
        echo "" >> $env_file
    fi
done

    for dir in $@; do
        current_dir=$blocks_dir/$dir
        if [ ! -d "$current_dir" ]; then
            echo "$current_dir is not a directory"
            exit 1
        fi


        if [ -f $current_dir/$compose_volume_section_create_flag ]; then
            if [ -z ${inserted_volume_section_start+x} ]; then
                echo "Adding volume section to $compose_file"
                cat $compose_volume_section_file >> $compose_file
                echo "" >> $compose_file
                inserted_volume_section_start=true
            fi

            echo "Adding volume for $current_dir to $compose_file"
            echo "  $dir-data-volume:" >> $compose_file
            echo "" >> $compose_file
        fi
    done
