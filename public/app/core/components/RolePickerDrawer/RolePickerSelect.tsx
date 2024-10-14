import { useState } from 'react';

import { MultiSelect } from '@grafana/ui';

import { RolePickerDrawer } from './RolePickerDrawer';

export interface Props {
  user: {
    name: string;
    login: string;
  };
}

export const RolePickerSelect = ({ user }: Props): JSX.Element => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  return (
    <>
      <MultiSelect onChange={() => {}} onOpenMenu={() => setIsDrawerOpen(true)} />
      {isDrawerOpen && <RolePickerDrawer onClose={() => setIsDrawerOpen(false)} user={user} />}
    </>
  );
};
