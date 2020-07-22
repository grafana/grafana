+++
title = "Add support for annotations"
type = "docs"
+++

# Add support for annotations

This guide explains how to add support for [annotations]({{< relref "../../dashboards/annotations.md" >}}) to an existing data source plugin.

This guide assumes that you're already familiar with how to [Build a data source plugin]({{< relref "../../../../../tutorials/build-a-data-source-plugin.md" >}}).

Data sources in Grafana can support [Annotations]({{< relref "../../dashboards/annotations.md" >}}) by handling _annotation queries_.

Handling annotation queries is similar to how you'd handle a metrics query. The difference is that instead of returning [data frames]({{< relref "data-frames.md" >}}), an annotation query returns _annotation events_.

## Add annotations support to your data source

To add logs support to an existing data source, you need to:

- Enable annotations support
- Override the `annotationQuery` method
- Construct annotation events

### Enable annotations support

Tell Grafana that your data source plugin can return annotations events by adding `"annotations": true` to the [plugin.json]({{< relref "metadata.md" >}}) file.

```json
{
  "annotations": true
}
```

### Override the `annotationQuery` method

In `DataSource.ts`, override the `annotationQuery` method from `DataSourceApi`.

```ts
async annotationQuery(options: AnnotationQueryRequest<MyQuery>): Promise<AnnotationEvent[]> {
  return [];
}
```

### Construct annotation events

Return an array of [AnnotationEvent]({{< relref "../../packages_api/data/annotationevent.md" >}}).

```ts
async annotationQuery(options: AnnotationQueryRequest<MyQuery>): Promise<AnnotationEvent[]> {
  const events: AnnotationEvent[] = [];

  const date = new Date();

  const event: AnnotationEvent = {
    time: date.valueOf(),
    text: 'foo',
    tags: ['bar'],
  };

  events.push(event);

  return events;
}
```

## Region annotations

[Region annotations]({{< relref "../../dashboards/annotations.md#adding-regions-events" >}}) have a start and end time. This can for example be used to annotate maintenance windows or downtime.

To return a region annotation, set the `timeEnd`, and `isRegion` properties.

```ts
const regionEvent: AnnotationEvent = {
  time: startDate.valueOf(),
  timeEnd: endDate.valueOf(),
  isRegion: true,
  text: 'foo',
  tags: ['bar'],
};
```

## Build a annotation query editor

Let users write custom annotation queries to only display the annotation events they care about, by adding a _query editor_.

> **Note**: Annotation query editors have yet to receive support for React. The instructions here are given for Angular. Fortunately, you can run Angular even in a plugin otherwise written using React. This section will be updated once React support for annotation queries editors is available.

1. Create a file called `AnnotationQueryEditor.ts` in the `src` directory, with the following content.

   ```ts
   export class AnnotationQueryEditor {
     static templateUrl = 'partials/annotations.editor.html';

     annotation: any;

     constructor() {
       this.annotation.queryText = this.annotation.queryText || '';
     }
   }
   ```

1. Create a directory called `partials` in the `src` directory.

1. Create a file called `annotations.editor.html` in the `partials` directory you just created, with the following content.

   ```html
   <div class="gf-form-group">
     <div class="gf-form-inline">
       <div class="gf-form gf-form--grow">
         <input
          class="gf-form-input"
          placeholder="query expression"
          ng-model="ctrl.annotation.queryText"
          ></input>
       </div>
     </div>
   </div>
   ```

1. In your data source query—the one that extends [DataQuery]({{< relref "../../packages_api/data/dataquery.md" >}})—add the `queryText` property. The name of the property needs to correspond to the text in `ng-model`, e.g. `ctrl.annotation.<propertyName>`.

   ```ts
   export interface MyQuery extends DataQuery {
     // ...
     queryText?: string;
   }
   ```

1. In `module.ts`, add the annotation query editor to the plugin.

   ```ts
   import { AnnotationQueryEditor } from './AnnotationQueryEditor';

   export const plugin = new DataSourcePlugin<DataSource, MyQuery, MyDataSourceOptions>(DataSource)
     .setConfigEditor(ConfigEditor)
     .setQueryEditor(QueryEditor)
     .setAnnotationQueryCtrl(AnnotationQueryEditor);
   ```

The `queryText` property is now available on the `options` object in the `annotationQuery` method:

```ts
async annotationQuery(options: AnnotationQueryRequest<MyQuery>): Promise<AnnotationEvent[]> {
  const expression = options.annotation.queryText;

  // ...
}
```
