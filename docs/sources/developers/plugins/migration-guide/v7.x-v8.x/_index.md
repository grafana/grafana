---
title: Migrate plugins from Grafana version 7.x.x to 8.x.x
menuTitle: v7.x to v8.x
description: Guide for migrating plugins from Grafana v7.x to v8.x.
keywords:
  - grafana
  - plugins
  - migration
  - plugin
  - documentation
weight: 2400
---

# Migrate plugins from Grafana version 7.x.x to 8.x.x

This section explains how to migrate Grafana v7.x.x plugins to the updated plugin system available in Grafana v8.x.x. Depending on your plugin, you need to perform one or more of the following steps.

In this section, we've documented the breaking changes in Grafana v8.x.x and the steps you need to take to upgrade your plugin.

## Backend plugin v1 support has been dropped

Use the new [plugin SDK for Go](https://github.com/grafana/grafana-plugin-sdk-go) to run your backend plugin running in Grafana 8.

### 1. Add dependency on grafana-plugin-sdk-go

Add a dependency on the `https://github.com/grafana/grafana-plugin-sdk-go`. We recommend using [Go modules](https://go.dev/blog/using-go-modules) to manage your dependencies.

### 2. Update the way you bootstrap your plugin

Update your `main` package to bootstrap via the new plugin Go SDK.

```go
// before
package main

import (
  "github.com/grafana/grafana_plugin_model/go/datasource"
  hclog "github.com/hashicorp/go-hclog"
  plugin "github.com/hashicorp/go-plugin"

  "github.com/myorgid/datasource/pkg/plugin"
)

func main() {
  pluginLogger.Debug("Running GRPC server")

  ds, err := NewSampleDatasource(pluginLogger);
  if err != nil {
    pluginLogger.Error("Unable to create plugin");
  }

  plugin.Serve(&plugin.ServeConfig{
    HandshakeConfig: plugin.HandshakeConfig{
			ProtocolVersion:  1,
			MagicCookieKey:   "grafana_plugin_type",
			MagicCookieValue: "datasource",
		},
    Plugins: map[string]plugin.Plugin{
			"myorgid-datasource": &datasource.DatasourcePluginImpl{Plugin: ds},
    },
    GRPCServer: plugin.DefaultGRPCServer,
  })
}

// after
package main

import (
  "os"

  "github.com/grafana/grafana-plugin-sdk-go/backend/log"
  "github.com/grafana/grafana-plugin-sdk-go/backend/datasource"

  "github.com/myorgid/datasource/pkg/plugin"
)

func main() {
  log.DefaultLogger.Debug("Running GRPC server")

  if err := datasource.Manage("myorgid-datasource", NewSampleDatasource, datasource.ManageOpts{}); err != nil {
				log.DefaultLogger.Error(err.Error())
				os.Exit(1)
		}
}
```

### 3. Update the plugin package

Update your `plugin` package to use the new plugin Go SDK:

```go
// before
package plugin

import (
  "context"

  "github.com/grafana/grafana_plugin_model/go/datasource"
  "github.com/hashicorp/go-hclog"
)

func NewSampleDatasource(pluginLogger hclog.Logger) (*SampleDatasource, error) {
	return &SampleDatasource{
		logger: pluginLogger,
	}, nil
}

type SampleDatasource struct{
  logger hclog.Logger
}

func (d *SampleDatasource) Query(ctx context.Context, tsdbReq *datasource.DatasourceRequest) (*datasource.DatasourceResponse, error) {
  d.logger.Info("QueryData called", "request", req)
  // logic for querying your datasource.
}

// after
package plugin

import (
  "context"

  "github.com/grafana/grafana-plugin-sdk-go/backend"
  "github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
  "github.com/grafana/grafana-plugin-sdk-go/backend/log"
  "github.com/grafana/grafana-plugin-sdk-go/data"
)

func NewSampleDatasource(_ backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	return &SampleDatasource{}, nil
}

type SampleDatasource struct{}


func (d *SampleDatasource) Dispose() {
	// Clean up datasource instance resources.
}

func (d *SampleDatasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
  log.DefaultLogger.Info("QueryData called", "request", req)
  // logic for querying your datasource.
}

func (d *SampleDatasource) CheckHealth(_ context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
  log.DefaultLogger.Info("CheckHealth called", "request", req)
  // The main use case for these health checks is the test button on the
  // datasource configuration page which allows users to verify that
  // a datasource is working as expected.
}
```

## Sign and load backend plugins

We strongly recommend that you not allow unsigned plugins in your Grafana installation. By allowing unsigned plugins, we can't guarantee the authenticity of the plugin, which could compromise the security of your Grafana installation.

To sign your plugin, see [Sign a plugin]({{< relref "../../publish-a-plugin/sign-a-plugin.md" >}}).

You can still run and develop an unsigned plugin by running your Grafana instance in [development mode](/docs/grafana/latest/administration/configuration/#app_mode). Alternatively, you can use the [allow_loading_unsigned_plugins]({{< relref "../../../../setup-grafana/configure-grafana#allow_loading_unsigned_plugins" >}}) configuration setting.

## Update react-hook-form from v6 to v7

We have upgraded react-hook-form from version 6 to version 7. To make your forms compatible with version 7, refer to the [react-hook-form-migration-guide](https://react-hook-form.com/migrate-v6-to-v7/).

## Update the plugin.json

The property that defines which Grafana version your plugin supports has been renamed and now it is a range instead of a specific version.

```json
// before
{
"dependencies": {
    "grafanaVersion": "7.5.x",
    "plugins": []
  }
}

// after
{
  "dependencies": {
    "grafanaDependency": ">=8.0.0",
    "plugins": []
  }
}
```

## Update imports to match emotion 11

Grafana uses the Emotion library to manage frontend styling. We've updated the Emotion package and this can affect your frontend plugin if you have custom styling. You only need to update the `import` statements to get it working in Grafana 8.

```ts
// before
import { cx, css } from 'emotion';

// after
import { cx, css } from '@emotion/css';
```

## Update needed for app plugins using dashboards

To make side navigation work properly - app plugins targeting Grafana `8.+` and integrating into the side menu via [addToNav]({{< relref "../../metadata#properties-4" >}}) property need to adjust their `plugin.json` and all dashboard json files to have a matching `uid`.

**`plugin.json`**

```json "linenos=inline,hl_lines=7,linenostart=1"
{
  "id": "plugin-id",
  // ...
  "includes": [
    {
      "type": "dashboard",
      "name": "(Team) Situation Overview",
      "path": "dashboards/example-dashboard.json",
      "addToNav": true,
      "defaultNav": false,
      "uid": "l3KqBxCMz"
    }
  ]
  // ...
}
```

**`dashboards/example-dashboard.json`**

```json
{
  // ...
  "title": "Example Dashboard",
  "uid": "l3KqBxCMz",
  "version": 1
  // ...
}
```

## 8.0 deprecations

The following features have been deprecated in version 8.0.

### Grafana theme v1

In Grafana 8 we have introduced a new improved version of our theming system. The previous version of the theming system is still available but is deprecated and will be removed in the next major version of Grafana.

You can find more detailed information on how to apply the v2 theme [here](https://github.com/grafana/grafana/blob/main/contribute/style-guides/themes.md#theming-grafana).

#### How to style a functional component

The `useStyles` hook is the preferred way to access the theme when styling. It provides basic memoization and access to the theme object:

```ts
// before
import React, { ReactElement } from 'react';
import css from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { useStyles } from '@grafana/ui';

function Component(): ReactElement | null {
  const styles = useStyles(getStyles);
}

const getStyles = (theme: GrafanaTheme) => ({
  myStyle: css`
    background: ${theme.colors.bodyBg};
    display: flex;
  `,
});

// after
import React, { ReactElement } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

function Component(): ReactElement | null {
  const theme = useStyles2(getStyles);
}

const getStyles = (theme: GrafanaTheme2) => ({
  myStyle: css`
    background: ${theme.colors.background.canvas};
    display: flex;
  `,
});
```

#### How to use the theme in a functional component

This example shows how to use the theme in a functional component:

```ts
// before
import React, { ReactElement } from 'react';
import { useTheme } from '@grafana/ui';

function Component(): ReactElement | null {
  const theme = useTheme();
}

// after
import React, { ReactElement } from 'react';
import { useTheme2 } from '@grafana/ui';

function Component(): ReactElement | null {
  const theme = useTheme2();
  // Your component has access to the theme variables now
}
```

#### How to use the theme in a class component

This example shows how to use the theme in a class:

```ts
// before
import React from 'react';
import { Themeable, withTheme } from '@grafana/ui';

type Props = {} & Themeable;

class Component extends React.Component<Props> {
  render() {
    const { theme } = this.props;
    // Your component has access to the theme variables now
  }
}

export default withTheme(Component);

// after
import React from 'react';
import { Themeable2, withTheme2 } from '@grafana/ui';

type Props = {} & Themeable2;

class Component extends React.Component<Props> {
  render() {
    const { theme } = this.props;
    // Your component has access to the theme variables now
  }
}

export default withTheme2(Component);
```

## Gradual migration of components

If you need to use both the v1 and v2 themes because you've used both migrated and non-migrated components in the same context, then use the `v1` property on the `v2` theme.

**Example:**

```ts
function Component(): ReactElement | null {
  const theme = useTheme2();
  return (
    <NonMigrated theme={theme.v1}>
      <Migrated theme={theme] />
    </NonMigrate>
  );
};
```
