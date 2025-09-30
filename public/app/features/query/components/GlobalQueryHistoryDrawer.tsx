import { ExploreDrawer } from '../../explore/ExploreDrawer';
import { useQueriesDrawerContext } from '../../explore/QueriesDrawer/QueriesDrawerContext';
import RichHistoryContainer from '../../explore/RichHistory/RichHistoryContainer';

/**
 * Global query history drawer that can be used across the app
 * This component should be rendered at the app level to be available everywhere
 * The RichHistoryCard components will automatically detect context and render appropriate run buttons
 */
export function GlobalQueryHistoryDrawer() {
  const { drawerOpened, setDrawerOpened } = useQueriesDrawerContext();

  if (!drawerOpened) {
    return null;
  }

  return (
    <ExploreDrawer>
      <RichHistoryContainer
        onClose={() => {
          setDrawerOpened(false);
        }}
      />
    </ExploreDrawer>
  );
}
