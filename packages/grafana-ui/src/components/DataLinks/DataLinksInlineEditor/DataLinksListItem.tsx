import { type DataLink } from '@grafana/data';

import { DataLinksListItemBase, type DataLinksListItemBaseProps } from './DataLinksListItemBase';

export const DataLinksListItem = DataLinksListItemBase<DataLink>;
export type DataLinksListItemProps = DataLinksListItemBaseProps<DataLink>;
