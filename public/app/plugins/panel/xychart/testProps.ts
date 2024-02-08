import { FieldMatcherID, FrameMatcherID } from "@grafana/data";

import { PanelOpts, SeriesMapping2 } from "./types2";

export const autoOpts: PanelOpts = {
  mapping: SeriesMapping2.Auto,
  series: [
    {
      x: {
        field: {
          matcher: {
            id: FieldMatcherID.byName,
            options: 'humidity', // base field name
          },
        },
      },
      y: {
        field: {
          matcher: {
            id: FieldMatcherID.byName,
            options: 'temperature', // base field name
          },
        },
      },
    },
  ],
};

export const manualOpts: PanelOpts = {
  mapping: SeriesMapping2.Manual,
  series: [
    {
      frame: {
        id: FrameMatcherID.byIndex,
        options: 0,
      },
      x: {
        field: {
          matcher: {
            id: FieldMatcherID.byName,
            options: 'humidity', // base field name
          },
        },
      },
      y: {
        field: {
          matcher: {
            id: FieldMatcherID.byName,
            options: 'temperature', // base field name
          },
        },
      },
    },
    {
      frame: {
        id: FrameMatcherID.byIndex,
        options: 3,
      },
      x: {
        field: {
          matcher: {
            id: FieldMatcherID.byName,
            options: 'humidity', // base field name
          },
        },
      },
      y: {
        field: {
          matcher: {
            id: FieldMatcherID.byName,
            options: 'temperature', // base field name
          },
        },
      },
    },
  ],
};
