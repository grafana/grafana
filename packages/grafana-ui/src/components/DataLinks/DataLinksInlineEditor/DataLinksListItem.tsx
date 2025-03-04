import { DataLink } from '@grafana/data';

import { DataLinksListItemBase, DataLinksListItemBaseProps } from './DataLinksListItemBase';

export const DataLinksListItem = DataLinksListItemBase<DataLink>;
export type DataLinksListItemProps = DataLinksListItemBaseProps<DataLink>;
