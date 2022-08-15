import React from 'react';

import { Drawer, Tab, TabsBar } from '@grafana/ui';

type Props = {
  onDismiss: () => void;
};

export const QueryEditorDrawer = ({ onDismiss }: Props) => {
  return (
    <Drawer title={'Query'} onClose={onDismiss} width={'40%'} subtitle={'query title'} expandable scrollableContent>
      <div>
        <div>Test query</div>
        <TabsBar>
          <Tab label={'Variables'} active={false} onChangeTab={() => {}} />
          <Tab label={'Connection'} active={true} onChangeTab={() => {}} />
          <Tab label={'History'} active={false} onChangeTab={() => {}} />
        </TabsBar>
      </div>
    </Drawer>
  );
};
