import React, { SFC } from 'react';
import classNames from 'classnames/bind';
import PluginListItem from './PluginListItem';
import { PluginListItem } from 'app/types';
import { LayoutMode, LayoutModes } from '../../core/components/LayoutSelector/LayoutSelector';

interface Props {
  plugins: PluginListItem[];
  layoutMode: LayoutMode;
}

const PluginList: SFC<Props> = props => {
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
