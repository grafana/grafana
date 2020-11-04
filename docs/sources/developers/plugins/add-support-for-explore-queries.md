+++
title = "Add support for Explore queries"
type = "docs"
+++

# Add support for Explore queries

This guide explains how to improve support for [Explore]({{< relref "../../explore/index.md" >}}) to an existing data source plugin.

This guide assumes that you're already familiar with how to [Build a data source plugin]({{< relref "../../../../../tutorials/build-a-data-source-plugin.md" >}}).

With Explore, users can make ad-hoc queries without the use of a dashboard. This is useful when users want to troubleshoot or to learn more about the data.

Your data source already supports Explore by default, and will use the existing query editor for the data source. If you want to offer extended Explore functionality for your data source however, you can define a Explore-specific query editor. Optionally, your plugin can also define a _start page_ for Explore.

## Add a query editor for Explore

The query editor for Explore is similar to the query editor for the data source itself. In fact, you'll probably reuse the same components for both query editors.

1. Create a file `ExploreQueryEditor.tsx` in the `src` directory of your plugin, with the following content:

   ```ts
   import React from 'react';

   import { ExploreQueryFieldProps } from '@grafana/data';
   import { QueryField } from '@grafana/ui';
   import { DataSource } from './DataSource';
   import { MyQuery, MyDataSourceOptions } from './types';

   export type Props = ExploreQueryFieldProps<DataSource, MyQuery, MyDataSourceOptions>;

   export default (props: Props) => {
     return (
       <h2>My query editor</h2>
     );
   };
   ```

1. Configure the plugin to use the `ExploreQueryEditor`.

   ```ts
   import ExploreQueryEditor from './ExploreQueryEditor';
   ```

   ```ts
   export const plugin = new DataSourcePlugin<DataSource, MyQuery, MyDataSourceOptions>(DataSource)
     .setConfigEditor(ConfigEditor)
     .setQueryEditor(QueryEditor)
     .setExploreQueryField(ExploreQueryEditor);
   ```

1. Add a [QueryField]({{< relref "../../packages_api/ui/queryfield.md" >}}) to `ExploreQueryEditor`.

   ```ts
   import { QueryField } from '@grafana/ui';
   ```

   ```ts
   export default (props: Props) => {
     const { query } = props;

     const onQueryChange = (value: string, override?: boolean) => {
       const { query, onChange, onRunQuery } = props;

       if (onChange) {
         // Update the query whenever the query field changes.
         onChange({ ...query, queryText: value });

         // Run the query on Enter.
         if (override && onRunQuery) {
           onRunQuery();
         }
       }
     };

     return (
       <QueryField
         portalOrigin="mock-origin"
         onChange={onQueryChange}
         onRunQuery={props.onRunQuery}
         onBlur={props.onBlur}
         query={query.queryText || ''}
         placeholder="Enter a query"
       />
     );
   };
   ```

## Add a start page for Explore

By adding an Explore start page for your plugin, you can for example create "cheat sheets" with commonly used queries. When the user clicks on one of the examples, it automatically updates the query editor, and runs the query. It's a great way to increase productivity for your users.

1. Create a file `ExploreStartPage.tsx` in the `src` directory of your plugin, with the following content:

   ```ts
   import React from 'react';
   import { ExploreStartPageProps } from '@grafana/data';

   export default (props: ExploreStartPageProps) => {
     return (
       <h2>My start page</h2>
     );
   };
   ```

1. Configure the plugin to use the `ExploreStartPage`.

   ```ts
   import ExploreStartPage from './ExploreStartPage';
   ```

   ```ts
   export const plugin = new DataSourcePlugin<DataSource, MyQuery, MyDataSourceOptions>(DataSource)
     .setConfigEditor(ConfigEditor)
     .setQueryEditor(QueryEditor)
     .setExploreQueryField(ExploreQueryEditor)
     .setExploreStartPage(ExploreStartPage);
   ```

1. Create a few examples.

   ```ts
   import React from 'react';
   import { ExploreStartPageProps, DataQuery } from '@grafana/data';

   const examples = [
     {
       title: 'Addition',
       expression: '1 + 2',
       label: 'Add two integers',
     },
     {
       title: 'Subtraction',
       expression: '2 - 1',
       label: 'Subtract an integer from another',
     },
   ];

   export default (props: ExploreStartPageProps) => {
     return (
       <div>
         <h2>Cheat Sheet</h2>
         {examples.map((item, index) => (
           <div className="cheat-sheet-item" key={index}>
             <div className="cheat-sheet-item__title">{item.title}</div>
             {item.expression ? (
               <div
                 className="cheat-sheet-item__example"
                 onClick={e => props.onClickExample({ refId: 'A', queryText: item.expression } as DataQuery)}
               >
                 <code>{item.expression}</code>
               </div>
             ) : null}
             <div className="cheat-sheet-item__label">{item.label}</div>
           </div>
         ))}
       </div>
     );
   };
   ```

## Support multiple Explore modes

Explore lets you query any data source, regardless of whether it returns metrics or logs. You can change which type of query you want to make, by setting the _Explore mode_.

The query modes that the plugin supports are defined in the [plugin.json]({{< relref "metadata.md" >}}) file.

The query mode is available on the `props` object for both the query editor and the start page. For example, here's how you can change the query editor based on the currently selected mode:

```
export default (props: Props) => {
  const { query, exploreMode } = props;

  switch (exploreMode) {
    case ExploreMode.Metrics:
      return <MetricsQueryField query={query} />;
    case ExploreMode.Logs:
      return <LogsQueryField query={query} />;
    default:
      return <p>Unsupported mode</p>;
  }
}
```
