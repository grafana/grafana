import { FlamegraphRenderer } from '@pyroscope/flamegraph';
import React from 'react';
import '@pyroscope/flamegraph/dist/index.css';

import { CoreApp, DataFrame, DataFrameView } from '@grafana/data';
import { config } from '@grafana/runtime';

import FlameGraphContainer from './FlameGraphContainer';

type Props = {
  data?: DataFrame;
  app: CoreApp;
  // Height for flame graph when not used in explore.
  // This needs to be different to explore flame graph height as we
  // use panels with user adjustable heights in dashboards etc.
  flameGraphHeight?: number;
};

export const FlameGraphTopWrapper = (props: Props) => {
  if (config.featureToggles.pyroscopeFlameGraph) {
    const profile = props.data ? dataFrameToFlameBearer(props.data) : undefined;
    return <FlamegraphRenderer profile={profile} />;
  }

  return <FlameGraphContainer data={props.data} app={props.app} />;
};

type Row = {
  level: number;
  label: string;
  value: number;
  self: number;
};

/**
 * Converts a nested set format from a DataFrame to a Flamebearer format needed by the pyroscope flamegraph.
 * @param data
 */
function dataFrameToFlameBearer(data: DataFrame) {
  // Unfortunately we cannot use @pyroscope/models for now as they publish ts files which then get type checked and
  // they do not pass our with our tsconfig
  const profile: any = {
    version: 1,
    flamebearer: {
      names: [],
      levels: [],
      numTicks: 0,
      maxSelf: 0,
    },
    metadata: {
      format: 'single' as const,
      sampleRate: 100,
      spyName: 'gospy' as const,
      units: 'samples' as const,
    },
  };
  const view = new DataFrameView<Row>(data);
  const labelField = data.fields.find((f) => f.name === 'label');

  if (labelField?.config?.type?.enum?.text) {
    profile.flamebearer.names = labelField.config.type.enum.text;
  }

  const labelMap: Record<string, number> = {};

  // Handle both cases where label is a string or a number pointing to enum config text array.
  const getLabel = (label: string | number) => {
    if (typeof label === 'number') {
      return label;
    } else {
      if (labelMap[label] === undefined) {
        labelMap[label] = profile.flamebearer.names.length;
        profile.flamebearer.names.push(label);
      }

      return labelMap[label];
    }
  };

  // Absolute offset where we are currently at.
  let offset = 0;

  for (let i = 0; i < data.length; i++) {
    // view.get() changes the underlying object, so we have to call this first get the value and then call get() for
    // current row.
    const prevLevel = i > 0 ? view.get(i - 1).level : undefined;
    const row = view.get(i);
    const currentLevel = row.level;
    const level = profile.flamebearer.levels[currentLevel];

    // First row is the root and always the total number of ticks.
    if (i === 0) {
      profile.flamebearer.numTicks = row.value;
    }
    profile.flamebearer.maxSelf = Math.max(profile.flamebearer.maxSelf, row.self);

    if (prevLevel && prevLevel >= currentLevel) {
      // we are going back to the previous level and adding sibling we have to figure out new offset
      offset = levelWidth(level);
    }

    if (!level) {
      // Starting a new level. Offset is what ever current absolute offset is as there are no siblings yet.
      profile.flamebearer.levels[row.level] = [offset, row.value, row.self, getLabel(row.label)];
    } else {
      // We actually need offset relative to sibling while offset variable contains absolute offset.
      const width = levelWidth(level);
      level.push(offset - width, row.value, row.self, getLabel(row.label));
    }
  }
  return profile;
}

/**
 * Get a width of a level. As offsets are relative to siblings we need to sum all the offsets and values in a level.
 * @param level
 */
function levelWidth(level: number[]) {
  let length = 0;
  for (let i = 0; i < level.length; i += 4) {
    const start = level[i];
    const value = level[i + 1];
    length += start + value;
  }
  return length;
}
