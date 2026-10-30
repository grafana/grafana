import { css } from '@emotion/css';
import { type ReactNode, type Ref } from 'react';
import Skeleton from 'react-loading-skeleton';

import { type GrafanaTheme2 } from '@grafana/data';
import { Box, ScrollContainer, Stack, Tab, TabContent, TabsBar, Text, useStyles2 } from '@grafana/ui';

import { CardFooter } from './FooterActions';
import { HomeSection } from './HomeSection';
import { tabChanged } from './analytics/main';

// Fixed height of the tab body: fits three compact rows so the two grid cards stay above the fold, and a tab
// switch or load state never moves the card.
const BODY_HEIGHT = 180;

export interface HomeCardTab {
  id: string;
  label: string;
  // Undefined while loading so the counter doesn't flash 0 before the data arrives.
  counter?: number;
  counterCappedAt?: number;
  // Sits at the footer's left; stays through loading and errors so the scope can still be changed.
  filter?: ReactNode;
  content: ReactNode;
  // The footer's right-hand action. Each tab gates this on its own data state; false renders nothing.
  footer?: ReactNode;
}

interface Props {
  title: string;
  // Right of the title; the header row keeps its height either way.
  headerExtra?: ReactNode;
  // Namespaces the tab and panel DOM ids: the bare tab ids are generic enough to collide with plugin content
  // on the same page.
  idPrefix: string;
  tabs: HomeCardTab[];
  // Falls back to the first tab when this id is not on offer, so a remembered tab that has since dropped out
  // still lands somewhere.
  activeTabId: string;
  onTabChange: (id: string) => void;
  // Stands in for the tab bar and body while it is unknown which tab to land on.
  loading?: boolean;
  ref?: Ref<HTMLDivElement>;
}

/** The titled card both homepage grid tabs share: a tab bar over a fixed-height body and a footer of one height. */
export function HomeTabbedCard({ title, headerExtra, idPrefix, tabs, activeTabId, onTabChange, loading, ref }: Props) {
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const panelId = `${idPrefix}-panel`;
  const tabElementId = (id: string) => `${idPrefix}-tab-${id}`;

  return (
    <Stack direction="column" gap={1} minWidth={0} ref={ref}>
      <Stack justifyContent="space-between" alignItems="center" minHeight={4}>
        <Text element="h2" variant="h5">
          {title}
        </Text>
        {headerExtra}
      </Stack>

      <HomeSection paddingX={2} paddingY={1} display="flex" direction="column" grow={1}>
        {loading ? (
          <HomeTabbedCardSkeleton />
        ) : (
          <>
            <TabsBar>
              {tabs.map((tab) => (
                <Tab
                  key={tab.id}
                  id={tabElementId(tab.id)}
                  aria-controls={panelId}
                  label={tab.label}
                  active={activeTab.id === tab.id}
                  counter={tab.counter}
                  counterCappedAt={tab.counterCappedAt}
                  onChangeTab={() => {
                    onTabChange(tab.id);
                    tabChanged({ tab: tab.id });
                  }}
                />
              ))}
            </TabsBar>
            <TabContent id={panelId} role="tabpanel" aria-labelledby={tabElementId(activeTab.id)}>
              <ScrollContainer showScrollIndicators height={`${BODY_HEIGHT}px`}>
                {activeTab.content}
              </ScrollContainer>
              <Box padding={1} paddingTop={1.5}>
                <CardFooter filter={activeTab.filter}>{activeTab.footer}</CardFooter>
              </Box>
            </TabContent>
          </>
        )}
      </HomeSection>
    </Stack>
  );
}

/** Same row placeholders as the summary cards, so the homepage loads as one. */
function HomeTabbedCardSkeleton() {
  const styles = useStyles2(getStyles);

  return (
    <Stack direction="column" gap={2} data-testid="home-tabbed-card-skeleton">
      <Stack direction="row" gap={2}>
        <Skeleton width={140} height={24} />
        <Skeleton width={140} height={24} />
      </Stack>
      {/* Reserves the body's height so the card doesn't jump when the rows arrive. */}
      <div className={styles.rows}>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} height={20} />
        ))}
      </div>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  rows: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    minHeight: BODY_HEIGHT,
  }),
});
