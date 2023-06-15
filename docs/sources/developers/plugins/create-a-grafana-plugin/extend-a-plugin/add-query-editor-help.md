---
title: Add query editor help
aliases:
  - ../../../plugins/add-query-editor-help/
keywords:
  - grafana
  - plugins
  - plugin
  - queries
  - query editor
  - query editor help
description: How to add a help component to query editors in Grafana.
weight: 500
---

# Add query editor help

Query editors support the addition of a help component to display examples of potential queries. When the user clicks on one of the examples, the query editor is automatically updated. This helps the user to make faster queries.

1. In the `src` directory of your plugin, create a file `QueryEditorHelp.tsx` with the following content:

   ```ts
   import React from 'react';
   import { QueryEditorHelpProps } from '@grafana/data';

   export default (props: QueryEditorHelpProps) => {
     return <h2>My cheat sheet</h2>;
   };
   ```

1. Configure the plugin to use `QueryEditorHelp`:

   ```ts
   import QueryEditorHelp from './QueryEditorHelp';
   ```

   ```ts
   export const plugin = new DataSourcePlugin<DataSource, MyQuery, MyDataSourceOptions>(DataSource)
     .setConfigEditor(ConfigEditor)
     .setQueryEditor(QueryEditor)
     .setQueryEditorHelp(QueryEditorHelp);
   ```

1. Create a few examples of potential queries:

   ```ts
   import React from 'react';
   import { QueryEditorHelpProps, DataQuery } from '@grafana/data';

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

   export default (props: QueryEditorHelpProps) => {
     return (
       <div>
         <h2>Cheat Sheet</h2>
         {examples.map((item, index) => (
           <div className="cheat-sheet-item" key={index}>
             <div className="cheat-sheet-item__title">{item.title}</div>
             {item.expression ? (
               <div
                 className="cheat-sheet-item__example"
                 onClick={(e) => props.onClickExample({ refId: 'A', queryText: item.expression } as DataQuery)}
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
