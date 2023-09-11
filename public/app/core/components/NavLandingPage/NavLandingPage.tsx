import React from 'react';

import { Flex, Grid, GridItem } from '@grafana/ui/src/unstable';
import { Page } from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';

import { NavLandingPageCard } from './NavLandingPageCard';

interface Props {
  navId: string;
  header?: React.ReactNode;
}

export function NavLandingPage({ navId, header }: Props) {
  const { node } = useNavModel(navId);
  const children = node.children?.filter((child) => !child.hideFromTabs);
  const gridChildren = () => {
    if (!children) {
      return [];
    }
    //@ts-ignore
    const list = children.map((child, i) => (
      <GridItem key={i} columnEnd={i===3 ? 'span 3' : undefined}>
        <NavLandingPageCard description={child.subTitle} text={child.text} url={child.url ?? ''} />
      </GridItem>
    ));
    return list;
  };
  return (
    <Page navId={node.id}>
      <Page.Contents>
        <Flex direction="column" gap={2}>
          {header}
          <Grid display="grid" gap={3} templateColumns="repeat(auto-fill, minmax(300px,1fr))" autoRows="138px">
            {gridChildren()}
          </Grid>
        </Flex>
      </Page.Contents>
    </Page>
  );
}
