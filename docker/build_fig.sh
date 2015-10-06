#!/bin/bash

blocks_dir=blocks
docker_dir=docker
template_dir=templates

grafana_config_file=conf.tmp
grafana_config=config

fig_file=fig.yml
fig_config=fig

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

for file in $gogs_config_file $fig_file; do
    if [ -e $file ]; then
        echo "Deleting $file"
        rm $file
    fi
done

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

    if [ -e $current_dir/$fig_config ]; then
        echo "Adding $current_dir/$fig_config to $fig_file"
        cat $current_dir/fig >> $fig_file
        echo "" >> $fig_file
    fi
done

