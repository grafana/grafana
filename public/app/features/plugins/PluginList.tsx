import React, { FC } from 'react';
import classNames from 'classnames';
import PluginListItem from './PluginListItem';
import { PluginMeta } from '@grafana/ui';
import { LayoutMode, LayoutModes } from '../../core/components/LayoutSelector/LayoutSelector';

interface Props {
  plugins: PluginMeta[];
  layoutMode: LayoutMode;
}

const PluginList: FC<Props> = props => {
  const { plugins, layoutMode } = props;

  const listStyle = classNames({
    'card-section': true,
    'card-list-layout-grid': layoutMode === LayoutModes.Grid,
    'card-list-layout-list': layoutMode === LayoutModes.List,
  });

  return (
    <section className={listStyle}>
      <ol className="card-list">
        {plugins.map((plugin, index) => {
          return <PluginListItem plugin={plugin} key={`${plugin.name}-${index}`} />;
        })}
      </ol>
    </section>
  );
};

export default PluginList;
