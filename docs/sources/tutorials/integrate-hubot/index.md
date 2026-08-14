---
Feedback Link: https://github.com/grafana/tutorials/issues/new
aliases:
  - /docs/grafana/latest/tutorials/hubot_howto/
authors:
  - grafana_labs
categories:
  - administration
description: Learn how to integrate Hubot with Grafana
id: integrate-hubot
labels:
  products:
    - enterprise
    - oss
status: Published
summary: Learn how to integrate Hubot with Grafana
tags:
  - advanced
title: Integrate Hubot with Grafana
---

# Integrate Hubot with Grafana

Grafana 2.0 shipped with a great feature that enables it to render any graph or panel to a PNG image.

No matter what data source you are using, the PNG image of the Graph will look the same as it does in your browser.

This guide shows you how to install and configure the [Hubot-Grafana](https://github.com/stephenyeargin/hubot-grafana) plugin. This plugin allows you to tell Hubot to render any dashboard or graph right from a channel in Slack, Basecamp, or any other supported Hubot adapter. The bot will respond with an image of the graph and a link that will take you to the graph.

{{< figure src="/static/img/docs/tutorials/hubot_grafana.png"  max-width="800px" >}}

## What is Hubot?

[Hubot](https://hubot.github.com/) is an universal and extensible chat bot that can be used with many chat services and has a huge library of third party plugins that allow you to automate anything from your chat rooms.

## Install Hubot

Hubot is very easy to install and host. If you do not already have a bot up and running please read the official [Getting Started With Hubot](https://hubot.github.com/docs/) guide.

## Install the Hubot-Grafana script

In your Hubot project repo install the Grafana plugin using `npm`:

```bash
npm install hubot-grafana --save
```

Edit the file external-scripts.json, and add hubot-grafana to the list of plugins.

```json
["hubot-pugme", "hubot-shipit", "hubot-grafana"]
```

## Configure

The Hubot-Grafana plugin requires two environment variables to be set in order to work properly.

```bash
export HUBOT_GRAFANA_HOST=https://play.grafana.org
export HUBOT_GRAFANA_API_KEY=abcd01234deadbeef01234
```

There are [additional environment variables](https://github.com/stephenyeargin/hubot-grafana?tab=readme-ov-file#general-settings) that you can set to control the appearance of the graphs.

### Grafana server side rendering

The hubot plugin will take advantage of the Grafana server side rendering feature that can render any panel on the server using phantomjs. Grafana ships with a phantomjs binary (Linux only).

To verify that this feature works try the `Direct link to rendered image` link in the panel share dialog. If you do not get an image when opening this link verify that the required font packages are installed for phantomjs to work.

### Grafana API Key

{{< figure src="/static/img/docs/v2/orgdropdown_api_keys.png" max-width="150px" class="docs-image--right">}}

You need to set the environment variable `HUBOT_GRAFANA_API_KEY` to a Grafana API Key. You can add these from the API Keys page which you find in the Organization dropdown.

### Image uploading

There are several approaches to uploading the rendered graphs. If you are using Slack, Rocket.Chat, or Telegram, the adapter's native uploader will take care of sending it through their respective API. If your Hubot is hosted on a platform that doesn't support uploads (such as IRC), you can use the [built-in S3 uploader](https://github.com/stephenyeargin/hubot-grafana/wiki/Amazon-S3-Image-Hosting). Note if you configure S3, it will not use the adapter's upload features.

## Hubot commands

- `hubot graf list`
  - Lists the available dashboards
- `hubot graf db graphite-carbon-metrics`
  - Graph all panels in the dashboard
- `hubot graf db graphite-carbon-metrics:3`
  - Graph only panel with id 3 of a particular dashboard
- `hubot graf db graphite-carbon-metrics:cpu`
  - Graph only the panels containing "cpu" (case insensitive) in the title
- `hubot graf db graphite-carbon-metrics now-12hr`
  - Get a dashboard with a window of 12 hours ago to now
- `hubot graf db graphite-carbon-metrics now-24hr now-12hr`
  - Get a dashboard with a window of 24 hours ago to 12 hours ago
- `hubot graf db graphite-carbon-metrics:3 now-8d now-1d`
  - Get only the third panel of a particular dashboard with a window of 8 days ago to yesterday
- `hubot graf db graphite-carbon-metrics host=carbon-a`
  - Get a templated dashboard with the `$host` parameter set to `carbon-a`

## Aliases

Some of the hubot commands above can lengthy and you might have to remember the dashboard slug (url id). If you have a few favorite graphs you want to be able check up on often (let's say from your mobile) you can create hubot command aliases with the hubot script `hubot-alias`.

Install it:

```bash
npm i --save hubot-alias
```

Now add `hubot-alias` to the list of plugins in `external-scripts.json` and restart hubot.

Now you can add an alias like this:

- `hubot alias graf-lb=graf db loadbalancers:2 now-20m`

{{< figure src="/static/img/docs/tutorials/hubot_grafana2.png"  max-width="800px" >}}

## Summary

Grafana is going to ship with integrated Slack and Hipchat features some day but you do not have to wait for that. Grafana 2 shipped with a very clever server side rendering feature that can render any panel to a png using phantomjs. The hubot plugin for Grafana is something you can install and use today!
