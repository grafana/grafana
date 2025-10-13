# Grafana Flamegraph component

> **@grafana/flamegraph is currently in BETA**.

This is a Flamegraph component that is used in Grafana and Pyroscope web app to display profiles.

## Usage

Currently this library exposes single component `Flamegraph` that renders whole visualization used for profiling which contains a header, a table representation of the data and a flamegraph.

```tsx
import { Flamegraph } from '@grafana/flamegraph';

<FlameGraph
  getTheme={() => createTheme({ colors: { mode: 'dark' } })}
  data={dataFrame}
  extraHeaderElements={
    <Button onClick={() => {}} variant="secondary">
      Download
    />
  }
  stickyHeader
  vertical
/>
```

#### Props

| Name                  | Type                     | Description                                                                                                                 |
| --------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| data                  | DataFrame                | DataFrame with the profile data. Optional, if missing or empty the flamegraph is not rendered                               |
| stickyHeader          | boolean                  | Whether the header should be sticky and be always visible on the top when scrolling.                                        |
| getTheme              | () => GrafanaTheme2      | Provides a theme for the visualization on which colors and some sizes are based.                                            |
| onTableSymbolClick    | (symbol: string) => void | Interaction hook that can be used to report on the interaction. Fires when user click on a name in the table.               |
| onViewSelected        | (view: string) => void   | Interaction hook that can be used to report on the interaction. Fires when user changes the view to show (table/graph/both) |
| onTextAlignSelected   | (align: string) => void  | Interaction hook that can be used to report on the interaction. Fires when user changes the text align.                     |
| onTableSort           | (sort: string) => void   | Interaction hook that can be used to report on the interaction. Fires when user changes the teble sorting.                  |
| extraHeaderElements   | React.ReactNode          | Elements that will be shown in the header on the right side of the header buttons. Useful for additional functionality.     |
| vertical              | boolean                  | If true the flamegraph will be rendered on top of the table.                                                                |
| keepFocusOnDataChange | boolean                  | If true any focused block will stay focused when the profile data changes. Same for the sandwich view.                      |

##### DataFrame schema

The dataFrame needs to have the following fields:

| Name       | Type     | Description                                                                                                        |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| name       | string   | The name of the node.                                                                                              |
| labels     | string[] | The labels of the node.                                                                                            |
| level      | number   | The nesting level of the node.                                                                                     |
| value      | number   | The total value of the node.                                                                                       |
| self       | number   | The self value of the node.                                                                                        |
| valueRight | number   | The total value of the node in the right profile. Optional, if present will show a diff version of the flamegraph. |
| selfRight  | number   | The self value of the node in the right profile. Optional, if present will show a diff version of the flamegraph.  |
