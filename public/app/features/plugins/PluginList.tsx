import React, { FC } from 'react';
import PluginListItem from './PluginListItem';
import { PluginMeta } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

interface Props {
  plugins: PluginMeta[];
}

const PluginList: FC<Props> = props => {
  const { plugins } = props;

  return (
    <section className="card-section card-list-layout-list">
      <ol className="card-list" aria-label={selectors.pages.PluginsList.list}>
        {plugins.map((plugin, index) => {
          return <PluginListItem plugin={plugin} key={`${plugin.name}-${index}`} />;
        })}
      </ol>
    </section>
  );
};

export default PluginList;
