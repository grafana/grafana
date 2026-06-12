import { type ComponentProps } from 'react';

import { Box } from '@grafana/ui';

type Props = Omit<ComponentProps<typeof Box>, 'backgroundColor' | 'borderRadius'>;

/** Canvas-colored card container used for homepage sections. */
export function HomeSection(props: Props) {
  return <Box backgroundColor="canvas" borderRadius="default" {...props} />;
}
