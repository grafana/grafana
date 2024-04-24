import React from 'react';

import { Menu } from '@grafana/ui';

export default function ShareMenu() {
  return (
    <Menu>
      <Menu.Item label="Share internally" description="Copy link" icon="building" />
    </Menu>
  );
}
