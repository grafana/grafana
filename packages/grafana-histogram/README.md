# Grafana Histogram component

> **@grafana/histogram is currently in BETA**.

This is a Histogram component that is used in Grafana to display histogram visualizations.

## Usage

Currently this library exposes histogram panel components and utilities for rendering histogram visualizations.

```tsx
import { HistogramPanel } from '@grafana/histogram';

<HistogramPanel data={dataFrame} options={options} width={width} height={height} />;
```

#### Props

| Name    | Type      | Description                                                                                           |
| ------- | --------- | ----------------------------------------------------------------------------------------------------- |
| data    | PanelData | Panel data containing the histogram data. Optional, if missing or empty the histogram is not rendered |
| options | Options   | Histogram panel options for configuration                                                             |
| width   | number    | Width of the visualization                                                                            |
| height  | number    | Height of the visualization                                                                           |
