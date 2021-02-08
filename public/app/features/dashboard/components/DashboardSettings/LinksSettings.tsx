import React from 'react';
import { DashboardModel } from '../../state/DashboardModel';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';

interface Props {
  dashboard: DashboardModel;
}

export const LinksSettings = ({ dashboard }: Props) => {
  const setupNew = () => console.log('setting up new link');
  return (
    <>
      <h3 className="dashboard-settings__header">Dashboard Links</h3>
      <EmptyListCTA
        onClick={setupNew}
        title="There are no dashboard links added yet"
        buttonIcon="link"
        buttonTitle="Add Dashboard Link"
        infoBoxTitle="What are Dashboard Links?"
        infoBox={{
          __html:
            '<p>Dashboard Links allow you to place links to other dashboards and web sites directly below the dashboard header.</p>',
        }}
      />
    </>
  );
};
