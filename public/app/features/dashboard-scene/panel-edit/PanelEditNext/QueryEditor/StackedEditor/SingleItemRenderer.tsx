import { useId } from 'react';

import { useStyles2 } from '@grafana/ui';

import { QueryEditorBody } from '../Body/QueryEditorBody';
import { DatasourceErrorAlert } from '../DatasourceErrorAlert';
import { getSelectedActionTarget } from '../Header/headerActionTarget';
import { useQueryEditorUIContext } from '../QueryEditorContext';

import { StackedSection } from './StackedSection';
import { getStackedLayoutStyles } from './styles';
import { getStackedItemFromTarget, getStackedItemKey } from './utils';

export function SingleItemRenderer() {
  const styles = useStyles2(getStackedLayoutStyles);
  const headingId = useId();
  // Not getSelectedStackedItem: when a query and a transformation are both selected, the query wins, matching cardType.
  const target = getSelectedActionTarget(useQueryEditorUIContext());
  const item = target ? getStackedItemFromTarget(target) : null;

  return (
    <div className={styles.container}>
      <div className={styles.errorAlert}>
        <DatasourceErrorAlert />
      </div>
      <QueryEditorBody>
        {item && <StackedSection key={getStackedItemKey(item)} item={item} isCurrent headingId={headingId} />}
      </QueryEditorBody>
    </div>
  );
}
