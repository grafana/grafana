---
title: Add support for Explore queries
---

# Add support for Explore queries

This guide explains how to improve support for [Explore]({{< relref "../../explore/" >}}) in an existing data source plugin.

This guide assumes that you're already familiar with how to [Build a data source plugin](/tutorials/build-a-data-source-plugin/).

With Explore, users can make ad-hoc queries without the use of a dashboard. This is useful when users want to troubleshoot or to learn more about the data.

Your data source supports Explore by default and uses the existing query editor for the data source.

## Add an Explore-specific query editor

To extend Explore functionality for your data source, you can define an Explore-specific query editor.

1. Create a file `ExploreQueryEditor.tsx` in the `src` directory of your plugin, with the following content:

   ```ts
   import React from 'react';

   import { QueryEditorProps } from '@grafana/data';
   import { QueryField } from '@grafana/ui';
   import { DataSource } from './DataSource';
   import { MyQuery, MyDataSourceOptions } from './types';

   type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

   export default (props: Props) => {
     return <h2>My Explore-specific query editor</h2>;
   };
   ```

1. Modify your base query editor in `QueryEditor.tsx` to render the Explore-specific query editor. For example:

   ```ts
   // [...]
   import { CoreApp } from '@grafana/data';
   import ExploreQueryEditor from './ExploreQueryEditor';

   type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

   export default (props: Props) => {
     const { app } = props;

     switch (app) {
       case CoreApp.Explore:
         return <ExploreQueryEditor {...props} />;
       default:
         return <div>My base query editor</div>;
     }
   };
   ```

## Selecting preferred visualisation

Explore should by default select a reasonable visualization for your data so users do not have to tweak and play with the visualizations and just focus on querying. This usually works fairly well and Explore can figure out whether the returned data is time series data or logs or something else.

If this does not work for you or you want to show some data in a specific visualization, add a hint to your returned data frame using the `preferredVisualisationType` meta attribute.

You can construct a data frame with specific metadata:

```
const firstResult = new MutableDataFrame({
    fields: [...],
    meta: {
        preferredVisualisationType: 'logs',
    },
});
```

For possible options, refer to [PreferredVisualisationType](https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/types/data.ts#L25).
