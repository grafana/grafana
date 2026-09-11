
import {
  type GrafanaTheme2,
  type TimeRange,
} from '@grafana/data';

import { type LogListModel } from './processing';

interface Props {
  log: LogListModel;
  logs: LogListModel[];
  prettifyDetailsJSON: boolean;
  search?: string;
  setPrettifyDetailsJSON: (prettifyDetailsJSON: boolean) => void;
  timeRange: TimeRange;
  timeZone: string;
}

export const LogLineDetailsOTelComponent = ({
  log,
  logs,
  prettifyDetailsJSON,
  search = '',
  setPrettifyDetailsJSON,
  timeRange,
  timeZone,
}: Props) => {
  return (
    <div>Todo</div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({

});
