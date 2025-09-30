import { useQueriesDrawerContext } from '../../explore/QueriesDrawer/QueriesDrawerContext';
import { ExploreDrawer } from '../../explore/ExploreDrawer';
import RichHistoryContainer from '../../explore/RichHistory/RichHistoryContainer';

/**
 * Global query history drawer that can be used across the app
 * This component should be rendered at the app level to be available everywhere
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
