+++ 
title = "DRAFT"
description = "DRAFT"
keywords = ["grafana", "image", "rendering", "plugin"]
draft = true 
+++

[//]: # 'TODO: put it below https://github.com/grafana/grafana/blob/e904f423e4f8caf495c285e4fc28fbcc44638048/docs/sources/image-rendering/_index.md#L77'

#### Context per render key

In `contextPerRenderKey` mode, the plugin will reuse the
same [browser context](https://chromedevtools.github.io/devtools-protocol/tot/Target/#method-createBrowserContext) for
all rendering requests sharing the same `renderKey` auth cookie and target domain within a short time window. Each new
request will open a new page within the existing context. Contexts are closed automatically after 5s of inactivity.

In the case of `contextPerRenderKey` mode, the `clustering.max_concurrency` option refers to the number of open contexts
rather than the number of open pages. There is no limit to the latter.

`contextPerRenderKey` was designed to improve the performance of the [dashboard previews crawler](TODO: ADD LINK).
