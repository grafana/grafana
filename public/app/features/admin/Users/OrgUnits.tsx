import React, { forwardRef, PropsWithChildren } from 'react';

import { IconName } from '@grafana/data';
import { Icon, Tooltip } from '@grafana/ui';
import { Box, Flex } from '@grafana/ui/src/unstable';
import { Unit } from 'app/types';

type OrgUnitProps = { units?: Unit[]; icon: IconName };

export const OrgUnits = ({ units, icon }: OrgUnitProps) => {
  if (!units?.length) {
    return null;
  }

  return units.length > 1 ? (
    <Tooltip
      placement={'top'}
      content={<Flex direction={'column'}>{units?.map((unit) => <span key={unit.name}>{unit.name}</span>)}</Flex>}
    >
      <Content icon={icon}>{units.length}</Content>
    </Tooltip>
  ) : (
    <Content icon={icon}>{units[0].name}</Content>
  );
};

interface ContentProps extends PropsWithChildren {
  icon: IconName;
}

export const Content = forwardRef<HTMLElement, ContentProps>(({ children, icon }, ref) => {
  return (
    <Box ref={ref} display={'flex'} alignItems={'center'} marginRight={1}>
      <Icon name={icon} /> <Box marginLeft={1}>{children}</Box>
    </Box>
  );
});

Content.displayName = 'TooltipContent';
