import { memo } from 'react';

import { TreeSelectBase, type TreeSelectProps } from './TreeSelectImplementation';

export const TreeSelect = memo((props: TreeSelectProps) => <TreeSelectBase {...props} />);

TreeSelect.displayName = 'TreeSelect';

export type { TreeSelectProps } from './TreeSelectImplementation';
