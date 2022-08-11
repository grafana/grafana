import {
  PanelPlugin,
} from '@grafana/data';

export const plugin = new PanelPlugin<CalendarOptions, CalendarConfig>(CalendarDasboard).setExplorePanel(CalendarExplore)

function Calendar(props: CalendarProps) {
  return "Calendar"
}

/**
 * This one will be used in dashboard context
 */
function CalendarDashboard(props: PanelProps<CalendarOptions>) {
  // use dashboard props to configure calendar component
  return <Calendar/>
}

/**
 * This one will be used in explore context.
 *
 * This alone isn't enough to be able to use this in explore. It still needs to have visualisationType set in plugin.json
 * otherwise we will never match it to any data.
 */
function CalendarExplore(props: ExplorePanelProps) {
  // use explore props to configure calendar component like some added interactivity
  return <Calendar/>
}



