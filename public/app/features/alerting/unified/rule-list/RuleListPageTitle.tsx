import { css } from '@emotion/css';
import { useCallback } from 'react';

import { Badge, Stack, useStyles2 } from '@grafana/ui';

import { useFeatureToggle } from '../featureToggles';

export function RuleListPageTitle({ title }: { title: string }) {
  const styles = useStyles2(ruleListPageTitleStyles);
  const { listViewV2Enabled, enableListViewV2, disableListViewV2 } = useV2AlertListViewToggle();

  const toggleListView = () => {
    if (listViewV2Enabled) {
      disableListViewV2();
    } else {
      enableListViewV2();
    }
    window.location.reload();
  };

  const badgeProps = listViewV2Enabled
    ? ({
        color: 'darkgrey',
        icon: undefined,
        text: 'Go back to the old look',
      } as const)
    : ({
        color: 'blue',
        icon: 'rocket',
        text: 'Try out the new look!',
      } as const);

  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
      <h1>{title}</h1>
      <div>
        <Badge {...badgeProps} onClick={toggleListView} className={styles.badge} />
      </div>
    </Stack>
  );
}

function useV2AlertListViewToggle() {
  const [listViewV2Enabled, setListViewV2Enabled] = useFeatureToggle('alertingListViewV2');

  const enableListViewV2 = useCallback(() => {
    setListViewV2Enabled(true);
  }, [setListViewV2Enabled]);

  const disableListViewV2 = useCallback(() => {
    setListViewV2Enabled(undefined);
  }, [setListViewV2Enabled]);

  return {
    listViewV2Enabled,
    enableListViewV2,
    disableListViewV2,
  };
}

const ruleListPageTitleStyles = () => ({
  badge: css({
    cursor: 'pointer',
  }),
});
