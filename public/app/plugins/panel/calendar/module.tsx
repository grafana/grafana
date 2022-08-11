import {
  PanelPlugin,
} from '@grafana/data';

export const plugin = new PanelPlugin<CalendarOptions, CalendarConfig>(Calendar)

// This should work in explore because we defined a visualisationType in plugin.json and so will match if some
// datasource returns DataFrame with preferredVisualisationType === 'calendar'.
function Calendar(props: PanelProps<CalendarOptions>) {
  return "Calendar"
}
