import React from 'react';

import { Flex, Grid } from '@grafana/ui/src/unstable';
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
    const list: React.JSX.Element[] = [];
    children?.forEach((child) => {
      list.push(
        <NavLandingPageCard key={child.id} description={child.subTitle} text={child.text} url={child.url ?? ''} />
      );
    });
    return list;
  };
  return (
    <Page navId={node.id}>
      <Page.Contents>
        <Flex direction="column" gap={2}>
          {header}
          {children && children.length > 0 && (
            <Grid display="grid" gap={3} templateColumns="repeat(auto-fill, minmax(300px,1fr))" autoRows="138px">
              {gridChildren()}
            </Grid>
          )}
        </Flex>
      </Page.Contents>
    </Page>
  );
}
