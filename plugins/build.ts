import { PluginBuildManifest } from '@grafana/toolkit';

const plugins: PluginBuildManifest = {
  external: [
    { clone: 'https://github.com/grafana/clock-panel' },
    { clone: 'https://github.com/grafana/piechart-panel' },
  ],
};
