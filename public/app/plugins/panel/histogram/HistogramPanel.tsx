import { PanelProps } from '@grafana/data';
import { HistogramPanel as HistogramPanelComponent } from '@grafana/histogram';

import { Options } from './panelcfg.gen';

type Props = PanelProps<Options>;

export const HistogramPanel = (props: Props) => {
  return <HistogramPanelComponent {...props} />;
};
